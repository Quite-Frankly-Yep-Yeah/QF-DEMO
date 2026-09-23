# frozen_string_literal: true

#
# Copyright (C) 2026 - present EXAMPLE contributors
#
# This file is part of EXAMPLE LMS, a modified version of Canvas.
#
# EXAMPLE LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

# Which self-paced courses a staff member can see on the dashboard, and what
# they may see in each (docs/fork-plan.md §2.6, §4).
#
# Teachers and TAs see the courses they teach. Account users (school mentors,
# admins) see every tracked course under their accounts. Either way the viewer
# must hold self_paced_view_dashboard in that course, and the course must have
# the dashboard and activity tracking turned on.
module SelfPaced
  class DashboardScope
    attr_reader :user

    def initialize(user)
      @user = user
    end

    def courses
      @courses ||= Course.where(id: candidate_course_ids).not_deleted.order(:name, :id).select do |course|
        SelfPaced.feature_enabled?(course, :self_paced_teacher_dashboard) &&
          SelfPaced.feature_enabled?(course, :self_paced_activity_tracking) &&
          course.grants_right?(user, :self_paced_view_dashboard)
      end
    end

    def course(course_id)
      courses.find { |course| course.id == course_id.to_i }
    end

    delegate :any?, to: :courses

    # Whether the viewer may open the dashboard at all, even before any of
    # their students are tracked: a mentor whose school has no activity yet
    # should get an empty dashboard, not a "not allowed" page.
    def allowed?
      any? || dashboard_accounts.any?
    end

    def grades_visible?(course)
      right?(course, :view_all_grades)
    end

    # Graders see what the gradebook shows (unposted); read-only staff see
    # only posted grades.
    def unposted_grades_visible?(course)
      right?(course, :manage_grades)
    end

    def live_visible?(course)
      right?(course, :self_paced_view_live_monitor)
    end

    private

    def right?(course, permission)
      @rights ||= {}
      @rights.fetch([course.id, permission]) { @rights[[course.id, permission]] = course.grants_right?(user, permission) }
    end

    # School accounts where the viewer holds the dashboard permission through
    # an account role (mentors, admins).
    def dashboard_accounts
      @dashboard_accounts ||= Account.where(id: user.account_users.active.select(:account_id)).active.select do |account|
        SelfPaced.feature_enabled?(account, :self_paced_teacher_dashboard) &&
          account.grants_right?(user, :self_paced_view_dashboard)
      end
    end

    def candidate_course_ids
      teaching_course_ids | account_course_ids
    end

    def teaching_course_ids
      user.enrollments.active.where(type: %w[TeacherEnrollment TaEnrollment]).distinct.pluck(:course_id)
    end

    # Only courses that already have tracked students, so an admin of a large
    # account doesn't make us check permissions on thousands of courses.
    def account_course_ids
      account_ids = user.account_users.active.pluck(:account_id)
      return [] if account_ids.empty?

      all_account_ids = account_ids.flat_map { |id| [id, *Account.sub_account_ids_recursive(id)] }.uniq
      StudentCourseState.joins(:course).where(courses: { account_id: all_account_ids }).distinct.pluck(:course_id)
    end
  end
end
