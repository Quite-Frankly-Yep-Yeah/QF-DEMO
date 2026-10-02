# frozen_string_literal: true

#
# Copyright (C) 2026 - present quite frankly an example LMS contributors
#
# This file is part of quite frankly an example LMS, a modified version of Canvas.
#
# quite frankly an example LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# quite frankly an example LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

# A student's support plans as a case manager sees and edits them
# (docs/teacher-workflow-plan.md Phase 1): plan details (tier 2), the
# accommodations, the support team (assigned caseload) and which teachers have
# acknowledged the current list. Every change is checked with Supports::Access.
module Supports
  class PlanEditor
    class Forbidden < StandardError; end

    PLAN_ATTRIBUTES = %w[plan_type start_date end_date case_manager_id notes workflow_state external_id].freeze
    ACCOMMODATION_ATTRIBUTES = %w[accommodation_type_id start_date end_date teacher_note].freeze

    attr_reader :access

    def initialize(viewer, student, root_account, real_user: nil)
      @viewer = viewer
      @student = student
      @root_account = root_account
      @real_user = real_user
      @access = Access.new(viewer, student, root_account)
    end

    # nil when the viewer may not see plan details. Logs the read otherwise.
    def as_json
      return nil unless @access.view!(:plan_details, subject: :plan, real_user: @real_user)

      can_manage = @access.can_manage?
      {
        student: { id: @student.id.to_s, name: @student.name, sortable_name: @student.sortable_name },
        can_manage:,
        plans: plans.map { |plan| plan_json(plan) },
        team: team_json,
        schools: @access.school_accounts.map { |account| { id: account.id.to_s, name: account.name } },
        courses: student_courses.map { |course| { id: course.id.to_s, name: course.name } },
        catalog: can_manage ? Catalog.types(@root_account).map(&:as_api_json) : []
      }
    end

    def plans
      Plan.not_deleted.where(student: @student, root_account: @root_account)
          .preload(:case_manager, :account, accommodations: :accommodation_type)
          .order(Arel.sql("workflow_state = 'active' DESC"), start_date: :desc, id: :desc)
    end

    def create_plan!(attrs)
      authorize!
      attrs = attrs.to_h.stringify_keys
      account = @access.school_accounts.find { |school| school.id.to_s == attrs["account_id"].to_s } ||
                @access.school_accounts.first
      plan = Plan.new(account:, student: @student, created_by: @viewer, source: "manual")
      assign_plan(plan, attrs)
      plan.save!
      plan
    end

    def update_plan!(plan, attrs)
      authorize!(plan)
      assign_plan(plan, attrs.to_h.stringify_keys)
      plan.save!
      plan
    end

    def delete_plan!(plan)
      authorize!(plan)
      plan.update!(workflow_state: "deleted")
    end

    def add_accommodation!(plan, attrs)
      authorize!(plan)
      accommodation = plan.accommodations.new
      assign_accommodation(accommodation, attrs.to_h.stringify_keys)
      Plan.transaction do
        accommodation.save!
        plan.bump_version!
      end
      accommodation
    end

    def update_accommodation!(accommodation, attrs)
      authorize!(accommodation.plan)
      assign_accommodation(accommodation, attrs.to_h.stringify_keys)
      Plan.transaction do
        changed = accommodation.changed? && (accommodation.changed - ["last_verified_at"]).any?
        accommodation.save!
        accommodation.plan.bump_version! if changed
      end
      accommodation
    end

    def remove_accommodation!(accommodation)
      authorize!(accommodation.plan)
      Plan.transaction do
        accommodation.update!(workflow_state: "deleted")
        accommodation.plan.bump_version!
      end
    end

    # nil when +user+ isn't staff.
    def add_team_member!(user)
      authorize!
      return nil unless staff?(user)

      Caseload.create_or_find_by!(root_account: @root_account, staff: user, student: @student) do |row|
        row.assigned_by = @viewer
      end
    end

    def remove_team_member!(user)
      authorize!
      Caseload.where(root_account: @root_account, staff: user, student: @student).delete_all
    end

    # Whether +user+ is staff somewhere in the root account (an account role),
    # so they can be a case manager or on a support team.
    def staff?(user)
      AccountUser.active.where(user:, account_id: Account.where(root_account_id: @root_account.id).select(:id))
                 .or(AccountUser.active.where(user:, account_id: @root_account.id)).exists?
    end

    private

    def authorize!(plan = nil)
      raise Forbidden unless @access.can_manage?
      raise Forbidden if plan && (plan.student_id != @student.id || plan.root_account_id != @root_account.id)
    end

    def assign_plan(plan, attrs)
      attrs = attrs.slice(*PLAN_ATTRIBUTES)
      if attrs.key?("case_manager_id")
        manager = attrs["case_manager_id"].presence && User.find_by(id: attrs["case_manager_id"])
        if attrs["case_manager_id"].present? && !(manager && staff?(manager))
          plan.errors.add(:case_manager_id, I18n.t("must be a staff member"))
          raise ActiveRecord::RecordInvalid, plan
        end
        attrs["case_manager_id"] = manager&.id
      end
      attrs.delete("workflow_state") unless %w[active archived].include?(attrs["workflow_state"])
      attrs["external_id"] = attrs["external_id"].presence if attrs.key?("external_id")
      plan.assign_attributes(attrs)
    end

    def assign_accommodation(accommodation, attrs)
      type_id = attrs["accommodation_type_id"]
      if type_id.present? && type_id.to_s != accommodation.accommodation_type_id.to_s
        type = AccommodationType.active.find_by(id: type_id, root_account: @root_account)
        unless type
          accommodation.errors.add(:accommodation_type_id, I18n.t("is not in the catalog"))
          raise ActiveRecord::RecordInvalid, accommodation
        end
        accommodation.accommodation_type = type
        accommodation.parameters = type.default_parameters if accommodation.new_record? && !attrs.key?("parameters")
      end
      accommodation.assign_attributes(attrs.slice(*(ACCOMMODATION_ATTRIBUTES - ["accommodation_type_id"])))
      accommodation.parameters = parameters_param(attrs["parameters"]) if attrs.key?("parameters")
      if attrs.key?("course_ids")
        allowed = student_courses.map(&:id)
        accommodation.course_ids = Array(attrs["course_ids"]).map(&:to_i) & allowed
      end
      accommodation.last_verified_at = Time.zone.now if Canvas::Plugin.value_to_boolean(attrs["verified"]) || accommodation.new_record?
    end

    def parameters_param(value)
      hash = value.respond_to?(:to_unsafe_h) ? value.to_unsafe_h : value.to_h
      hash.stringify_keys.slice("multiplier", "minutes", "percent", "mode", "attempts", "every_days", "setting").compact_blank
    end

    def plan_json(plan)
      rows = plan.accommodations.select { |row| row.workflow_state == "active" }
                 .sort_by { |row| [row.accommodation_type.position, row.accommodation_type.name] }
      course_names = student_courses.to_h { |course| [course.id, course.name] }
      {
        id: plan.id.to_s,
        plan_type: plan.plan_type,
        type_label: plan.type_label,
        workflow_state: plan.workflow_state,
        school: { id: plan.account_id.to_s, name: plan.account.name },
        start_date: plan.start_date&.iso8601,
        end_date: plan.end_date&.iso8601,
        case_manager: plan.case_manager && { id: plan.case_manager_id.to_s, name: plan.case_manager.name },
        source: plan.source,
        external_id: plan.external_id,
        version: plan.version,
        notes: plan.notes,
        accommodations: rows.map { |row| row.teacher_json(course_names).merge(row.editor_json.except(:courses)) },
        acknowledgements: plan.active? ? acknowledgement_status(plan) : [],
        scans: scans_json(plan)
      }
    end

    # The original IEPs this plan was made from, for someone who may manage it:
    # each applied scan whose file is still kept. Only what is needed to link to
    # the file, never the file itself.
    def scans_json(plan)
      return [] unless @access.can_manage?

      Import.where(plan_id: plan.id, format: IepScan::FORMAT, workflow_state: "applied")
            .where.not(support_imports: { data: nil })
            .order(applied_at: :desc, id: :desc).select(:id, :filename, :applied_at)
            .map { |import| { id: import.id, filename: import.filename, applied_at: import.applied_at&.iso8601 } }
    end

    # The student's teachers, and whether each has acknowledged this version.
    def acknowledgement_status(plan)
      acknowledged = Acknowledgement.where(plan:, plan_version: plan.version).pluck(:user_id).to_set
      teachers.map do |teacher|
        { id: teacher.id.to_s, name: teacher.name, acknowledged: acknowledged.include?(teacher.id) }
      end
    end

    def teachers
      @teachers ||= User.where(id: Enrollment.where(course_id: student_courses.map(&:id),
                                                     type: %w[TeacherEnrollment TaEnrollment],
                                                     workflow_state: "active").select(:user_id))
                        .order(:sortable_name).to_a
    end

    def team_json
      managers = Plan.active.where(student: @student, root_account: @root_account).pluck(:case_manager_id).compact.to_set
      Caseload.where(student: @student, root_account: @root_account).preload(:staff).map do |row|
        { id: row.staff_id.to_s, name: row.staff.name, case_manager: managers.include?(row.staff_id) }
      end.sort_by { |member| [member[:case_manager] ? 0 : 1, member[:name].to_s] }
    end

    def student_courses
      @student_courses ||= Course.where(id: Enrollment.where(user_id: @student.id,
                                                              type: "StudentEnrollment",
                                                              workflow_state: "active",
                                                              root_account_id: @root_account.id).select(:course_id))
                                 .order(:name).to_a
    end
  end
end
