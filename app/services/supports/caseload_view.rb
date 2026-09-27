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

# The students a support person works with (docs/teacher-workflow-plan.md
# Phase 1): their assigned caseload, plus, for people who can see every
# student, everyone with an active plan in the schools they administer. Each
# row shows plan details, so each student the viewer can see is logged.
module Supports
  class CaseloadView
    MAX_ROWS = 500

    def initialize(viewer, root_account, real_user: nil, scope: "mine")
      @viewer = viewer
      @root_account = root_account
      @real_user = real_user
      @scope = (scope == "all") ? "all" : "mine"
    end

    # Whether the viewer can use the page at all: they can see plan details
    # somewhere in the root account.
    def allowed?
      return false unless Supports.feature_enabled?(@root_account, :supports_plans)

      Caseload.where(staff: @viewer, root_account: @root_account).exists? || all_students_accounts.any?
    end

    def can_see_all?
      all_students_accounts.any?
    end

    def rows
      students = User.where(id: candidate_ids).order(:sortable_name).limit(MAX_ROWS).to_a
      plans = Plan.active.where(student_id: students.map(&:id), root_account: @root_account)
                  .preload(:case_manager).group_by(&:student_id)
      counts = StudentAccommodation.current.where(student_id: students.map(&:id), root_account_id: @root_account.id)
                                   .group("student_accommodations.student_id").count
      assigned = Caseload.where(staff: @viewer, root_account: @root_account).pluck(:student_id).to_set

      students.filter_map do |student|
        access = Access.new(@viewer, student, @root_account)
        next unless access.view!(:plan_details, subject: :caseload, real_user: @real_user)

        student_plans = plans[student.id] || []
        {
          student: { id: student.id.to_s, name: student.name, sortable_name: student.sortable_name },
          assigned: assigned.include?(student.id),
          plans: student_plans.map do |plan|
            { id: plan.id.to_s, plan_type: plan.plan_type, type_label: plan.type_label, end_date: plan.end_date&.iso8601,
              case_manager: plan.case_manager&.name }
          end,
          next_review: student_plans.filter_map(&:end_date).min&.iso8601,
          accommodations: counts[student.id].to_i,
          unacknowledged: unacknowledged_count(student_plans)
        }
      end
    end

    private

    def candidate_ids
      ids = Caseload.where(staff: @viewer, root_account: @root_account).pluck(:student_id)
      if @scope == "all" && all_students_accounts.any?
        account_ids = all_students_accounts.flat_map { |account| Account.sub_account_ids_recursive(account.id) + [account.id] }
        ids |= Plan.active.where(root_account: @root_account, account_id: account_ids).distinct.pluck(:student_id)
      end
      ids
    end

    # The accounts where the viewer may see plan details for every student.
    def all_students_accounts
      @all_students_accounts ||= begin
        accounts = Account.where(id: @viewer.account_users.active.select(:account_id))
                          .where("accounts.id = ? OR accounts.root_account_id = ?", @root_account.id, @root_account.id).to_a
        accounts.select do |account|
          account.grants_right?(@viewer, :supports_view_all_students) && account.grants_right?(@viewer, :supports_view_plans)
        end
      end
    end

    # How many of the student's teachers haven't acknowledged the current
    # version of one of their active plans.
    def unacknowledged_count(plans)
      plans = plans.select { |plan| plan.accommodations.active.exists? }
      return 0 if plans.empty?

      course_ids = Enrollment.where(user_id: plans.first.student_id, type: "StudentEnrollment", workflow_state: "active",
                                    root_account_id: @root_account.id).select(:course_id)
      teacher_ids = Enrollment.where(course_id: course_ids, type: %w[TeacherEnrollment TaEnrollment], workflow_state: "active")
                              .distinct.pluck(:user_id)
      plans.sum do |plan|
        acknowledged = Acknowledgement.where(plan:, plan_version: plan.version).pluck(:user_id)
        (teacher_ids - acknowledged).size
      end
    end
  end
end
