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

# A student's accommodations card (tier 1, for teachers) and plan details
# (tier 2, for support staff), and finding a student to start a plan for.
module Supports
  class StudentsController < BaseController
    SEARCH_LIMIT = 20
    APPLICATIONS_LIMIT = 200
    STAFF_ENROLLMENTS = %w[TeacherEnrollment TaEnrollment DesignerEnrollment].freeze

    before_action :find_student, except: :search

    # GET /api/v1/supports/students/:student_id/accommodations
    def accommodations
      json = AccommodationCard.new(@current_user, @student, @domain_root_account, real_user:).as_json
      return render_unauthorized_action unless json

      render json:
    end

    # POST /api/v1/supports/students/:student_id/acknowledgement
    def acknowledge
      card = AccommodationCard.new(@current_user, @student, @domain_root_account, real_user:)
      return render_unauthorized_action unless card.acknowledge!

      render json: card.as_json
    end

    # GET /api/v1/supports/students/:student_id
    def show
      json = PlanEditor.new(@current_user, @student, @domain_root_account, real_user:).as_json
      return render_unauthorized_action unless json

      render json:
    end

    # GET /api/v1/supports/students/:student_id/applications?days=7
    #
    # What the app applied for the student's accommodations lately: extra quiz
    # time and attempts, pacing, display settings (Phase 2). Tier 2.
    def applications
      access = Access.new(@current_user, @student, @domain_root_account)
      return render_unauthorized_action unless access.view!(:plan_details, subject: :applications, real_user:)

      days = (params[:days].presence || 7).to_i.clamp(1, 90)
      rows = Application.where(student: @student, root_account: @domain_root_account)
                        .since(days.days.ago).order(created_at: :desc, id: :desc).limit(APPLICATIONS_LIMIT)
                        .preload(student_accommodation: :accommodation_type).to_a
      course_names = Course.where(id: rows.filter_map(&:course_id).uniq).pluck(:id, :name).to_h
      quiz_titles = Quizzes::Quiz.where(id: rows.filter_map { |row| row.details["quiz_id"] }.uniq).pluck(:id, :title)
                                 .to_h { |id, title| [id.to_s, title] }
      render json: {
        days:,
        applications: rows.map do |row|
          row.as_api_json(course_names).merge(accommodation: row.student_accommodation&.accommodation_type&.name,
                                              quiz_title: quiz_titles[row.details["quiz_id"]])
        end
      }
    end

    # GET /api/v1/supports/students?search_term=
    #
    # Students in the schools where the viewer can manage every student's
    # plans, found by name, SIS user ID or login ID. A student is someone
    # enrolled as one in those schools, or with a login at this school and no
    # staff role, so a new student shows up before they are in a course. Names
    # and SIS IDs only: nothing protected.
    def search
      accounts = manage_all_accounts
      return render_unauthorized_action if accounts.empty?

      term = params[:search_term].to_s.strip
      return render json: { students: [] } if term.length < 2

      account_ids = accounts.flat_map { |account| Account.sub_account_ids_recursive(account.id) + [account.id] }.uniq
      students = User.active.where(id: student_ids(account_ids))
                     .merge(User.where(User.wildcard("users.name", term, type: :full)).or(User.where(id: login_matches(term))))
                     .order(:sortable_name).limit(SEARCH_LIMIT).to_a
      sis_ids = school_logins.where(user_id: students.map(&:id)).where.not(sis_user_id: nil).pluck(:user_id, :sis_user_id).to_h
      render json: { students: students.map { |student| { id: student.id.to_s, name: student.name, sis_user_id: sis_ids[student.id] } } }
    end

    private

    def school_logins
      Pseudonym.active_only.where(account_id: @domain_root_account.id)
    end

    # Users whose SIS user ID or login ID starts with +term+.
    def login_matches(term)
      like = "#{Pseudonym.sanitize_sql_like(term.downcase)}%"
      school_logins.where("LOWER(pseudonyms.sis_user_id) LIKE :like OR LOWER(pseudonyms.unique_id) LIKE :like", like:).select(:user_id)
    end

    def student_ids(account_ids)
      course_ids = Course.where(account_id: account_ids).active.select(:id)
      enrolled = Enrollment.where(course_id: course_ids, type: "StudentEnrollment", workflow_state: "active").select(:user_id)
      staff = Enrollment.where(course_id: course_ids, type: STAFF_ENROLLMENTS).where.not(workflow_state: %w[deleted rejected inactive completed])
                        .select(:user_id)
      admins = AccountUser.active.where(account_id: account_ids + [@domain_root_account.id]).select(:user_id)
      with_login = school_logins.where.not(user_id: staff).where.not(user_id: admins).select(:user_id)
      User.where(id: enrolled).or(User.where(id: with_login)).select(:id)
    end

    def manage_all_accounts
      Account.where(id: @current_user.account_users.active.select(:account_id))
             .where("accounts.id = ? OR accounts.root_account_id = ?", @domain_root_account.id, @domain_root_account.id)
             .select do |account|
               account.grants_right?(@current_user, :supports_manage_plans) &&
                 account.grants_right?(@current_user, :supports_view_all_students)
             end
    end
  end
end
