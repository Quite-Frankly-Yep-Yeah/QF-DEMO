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

# The students a viewer may manage plans for in a school, and finding one by
# name, SIS user ID or login ID. A viewer with the all-students permission
# gets every student in the schools they hold it in: someone enrolled as a
# student there, or with a login at the school and no staff role, so a new
# student shows up before they are in a course. Anyone else who manages plans
# gets only their caseload. Shared by the search endpoint and the IEP matcher
# so the two cannot disagree. Names and SIS IDs only: nothing protected.
module Supports
  class StudentSearch
    STAFF_ENROLLMENTS = %w[TeacherEnrollment TaEnrollment DesignerEnrollment].freeze

    def initialize(viewer, root_account)
      @viewer = viewer
      @root_account = root_account
    end

    # Whether the viewer may manage plans for at least some students here.
    def allowed?
      return false unless @viewer && Supports.enabled?(@root_account)

      manage_all_accounts.any? || (manages_plans? && caseload.exists?)
    end

    # The students the viewer may manage (a User relation).
    def scope
      return User.none unless allowed?

      ids = manage_all_accounts.any? ? student_ids(account_ids) : caseload.select(:student_id)
      User.active.where(id: ids).where.not(id: @viewer.id)
    end

    # [{id:, name:, sis_user_id:}] whose name, SIS user ID or login ID starts with +term+.
    def search(term, limit: 20)
      term = term.to_s.strip
      return [] if term.length < 2

      students = scope.merge(User.where(User.wildcard("users.name", term, type: :full)).or(User.where(id: login_matches(term))))
                      .order(:sortable_name).limit(limit).to_a
      sis_ids = sis_user_ids(students)
      students.map { |student| { id: student.id.to_s, name: student.name, sis_user_id: sis_ids[student.id] } }
    end

    # { user id => SIS user ID } for the users that have one at this school.
    def sis_user_ids(users)
      school_logins.where(user_id: users.map(&:id)).where.not(sis_user_id: nil).pluck(:user_id, :sis_user_id).to_h
    end

    def school_logins
      Pseudonym.active_only.where(account_id: @root_account.id)
    end

    private

    def caseload
      Caseload.where(root_account: @root_account, staff_id: @viewer.id)
    end

    # Users whose SIS user ID or login ID starts with +term+.
    def login_matches(term)
      like = "#{Pseudonym.sanitize_sql_like(term.downcase)}%"
      school_logins.where("LOWER(pseudonyms.sis_user_id) LIKE :like OR LOWER(pseudonyms.unique_id) LIKE :like", like:).select(:user_id)
    end

    def account_ids
      @account_ids ||= manage_all_accounts.flat_map { |account| Account.sub_account_ids_recursive(account.id) + [account.id] }.uniq
    end

    def student_ids(account_ids)
      course_ids = Course.where(account_id: account_ids).active.select(:id)
      enrolled = Enrollment.where(course_id: course_ids, type: "StudentEnrollment", workflow_state: "active").select(:user_id)
      staff = Enrollment.where(course_id: course_ids, type: STAFF_ENROLLMENTS).where.not(workflow_state: %w[deleted rejected inactive completed])
                        .select(:user_id)
      admins = AccountUser.active.where(account_id: account_ids + [@root_account.id]).select(:user_id)
      with_login = school_logins.where.not(user_id: staff).where.not(user_id: admins).select(:user_id)
      User.where(id: enrolled).or(User.where(id: with_login)).select(:id)
    end

    def school_accounts
      @school_accounts ||= Account.where(id: @viewer.account_users.active.select(:account_id))
                                  .where("accounts.id = ? OR accounts.root_account_id = ?", @root_account.id, @root_account.id).to_a
    end

    def manages_plans?
      school_accounts.any? { |account| account.grants_right?(@viewer, :supports_manage_plans) }
    end

    def manage_all_accounts
      @manage_all_accounts ||= school_accounts.select do |account|
        account.grants_right?(@viewer, :supports_manage_plans) && account.grants_right?(@viewer, :supports_view_all_students)
      end
    end
  end
end
