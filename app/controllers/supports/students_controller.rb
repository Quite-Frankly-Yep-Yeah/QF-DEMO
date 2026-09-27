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

    # GET /api/v1/supports/students?search_term=
    #
    # Students in the schools where the viewer can manage every student's
    # plans. Names only: nothing protected.
    def search
      accounts = manage_all_accounts
      return render_unauthorized_action if accounts.empty?

      term = params[:search_term].to_s.strip
      return render json: { students: [] } if term.length < 2

      account_ids = accounts.flat_map { |account| Account.sub_account_ids_recursive(account.id) + [account.id] }.uniq
      course_ids = Course.where(account_id: account_ids).active.select(:id)
      students = User.active
                     .where(id: Enrollment.where(course_id: course_ids, type: "StudentEnrollment", workflow_state: "active").select(:user_id))
                     .where(User.wildcard("users.name", term, type: :full))
                     .order(:sortable_name).limit(SEARCH_LIMIT)
      render json: { students: students.map { |student| { id: student.id.to_s, name: student.name } } }
    end

    private

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
