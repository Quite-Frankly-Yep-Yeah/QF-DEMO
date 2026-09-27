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

# The need-to-know rules for a student's protected support records
# (docs/teacher-workflow-plan.md §2.2).
#
# - Tier 1 (accommodations): the student's teachers and TAs, anyone the student
#   is assigned to, and holders of supports_view_accommodations who can see all
#   students.
# - Tier 2 (plan details): assigned staff with supports_view_plans, and holders
#   of supports_view_plans who can see all students. Teachers of record don't.
# - Tier 3 (documents): assigned staff or all-students holders with
#   supports_manage_plans.
#
# Students and parents see nothing yet (Q5). Everything is off unless the
# student_supports flag is on. Masquerading is judged as the user being
# masqueraded as; the real user is written to the log.
#
#   access = Supports::Access.new(viewer, student, root_account)
#   access.view!(:accommodations, subject: :accommodations, real_user:) # => true, and logged
module Supports
  class Access
    TIER_PERMISSIONS = {
      1 => :supports_view_accommodations,
      2 => :supports_view_plans,
      3 => :supports_manage_plans
    }.freeze

    attr_reader :viewer, :student, :root_account

    def initialize(viewer, student, root_account)
      @viewer = viewer
      @student = student
      @root_account = root_account
    end

    # The tiers +viewer+ may see for +student+, lowest first.
    def tiers
      @tiers ||= compute_tiers
    end

    def can_view?(tier)
      tiers.include?(tier_number(tier))
    end

    # Checks access to +tier+ and logs the read when it is allowed. Returns
    # whether the viewer may see it.
    def view!(tier, subject:, real_user: nil)
      number = tier_number(tier)
      return false unless tiers.include?(number)

      AccessLog.record!(viewer:, student:, tier: number, subject:, root_account:, real_user:)
      true
    end

    private

    def tier_number(tier)
      number = tier.is_a?(Integer) ? tier : Supports::TIERS.fetch(tier.to_sym)
      raise ArgumentError, "unknown tier: #{tier}" unless Supports::TIERS.value?(number)

      number
    end

    def compute_tiers
      return [] unless viewer && student && root_account && Supports.enabled?(root_account)
      return [] if viewer.id == student.id

      assigned = Caseload.assigned?(viewer, student, root_account)
      all_students = holds?(:supports_view_all_students)

      tiers = []
      tiers << 1 if assigned || teaches_student? || (all_students && holds?(TIER_PERMISSIONS[1]))
      [2, 3].each do |tier|
        tiers << tier if (assigned || all_students) && holds?(TIER_PERMISSIONS[tier])
      end
      tiers
    end

    # Whether the viewer is an active teacher or TA in a course where the
    # student is an active student.
    def teaches_student?
      Enrollment.where(user_id: viewer.id,
                       type: %w[TeacherEnrollment TaEnrollment],
                       workflow_state: "active",
                       course_id: student_course_ids).exists?
    end

    def student_course_ids
      Enrollment.where(user_id: student.id,
                       type: "StudentEnrollment",
                       workflow_state: "active",
                       root_account_id: root_account.id).select(:course_id)
    end

    # Whether the viewer holds +permission+ in an account over one of the
    # student's courses (or the root account when they have none).
    def holds?(permission)
      @held ||= {}
      return @held[permission] if @held.key?(permission)

      @held[permission] = school_accounts.any? { |account| account.grants_right?(viewer, permission) }
    end

    def school_accounts
      @school_accounts ||= begin
        accounts = Account.where(id: Course.where(id: student_course_ids).select(:account_id)).to_a
        accounts.presence || [root_account]
      end
    end
  end
end
