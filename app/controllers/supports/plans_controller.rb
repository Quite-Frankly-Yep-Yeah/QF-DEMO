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

# Creating and editing a student's plans, accommodations and support team.
# Supports::PlanEditor checks every change; each response is the student's
# refreshed plan details.
module Supports
  class PlansController < BaseController
    STAFF_LIMIT = 20

    before_action :find_plan, only: %i[update destroy add_accommodation]
    before_action :find_accommodation, only: %i[update_accommodation remove_accommodation]
    before_action :find_student, only: %i[create add_team remove_team]

    # POST /api/v1/supports/students/:student_id/plans
    def create
      editor.create_plan!(plan_params)
      render_student
    end

    # PUT /api/v1/supports/plans/:id
    def update
      editor.update_plan!(@plan, plan_params)
      render_student
    end

    # DELETE /api/v1/supports/plans/:id
    def destroy
      editor.delete_plan!(@plan)
      render_student
    end

    # POST /api/v1/supports/plans/:id/accommodations
    def add_accommodation
      editor.add_accommodation!(@plan, accommodation_params)
      render_student
    end

    # PUT /api/v1/supports/accommodations/:id
    def update_accommodation
      editor.update_accommodation!(@accommodation, accommodation_params)
      render_student
    end

    # DELETE /api/v1/supports/accommodations/:id
    def remove_accommodation
      editor.remove_accommodation!(@accommodation)
      render_student
    end

    # PUT /api/v1/supports/students/:student_id/team/:user_id
    def add_team
      member = User.find_by(id: params[:user_id])
      unless member && editor.add_team_member!(member)
        return render json: { errors: [t("Only staff can be added to a support team.")] }, status: :unprocessable_content
      end

      render_student
    end

    # DELETE /api/v1/supports/students/:student_id/team/:user_id
    def remove_team
      editor.remove_team_member!(User.find_by(id: params[:user_id]) || User.new)
      render_student
    end

    # GET /api/v1/supports/staff?search_term=
    #
    # Staff in the root account, to pick a case manager or team member from.
    def staff
      return render_unauthorized_action unless can_pick_staff?

      term = params[:search_term].to_s.strip
      return render json: { staff: [] } if term.length < 2

      account_ids = Account.where(root_account_id: @domain_root_account.id).select(:id)
      users = User.active
                  .where(id: AccountUser.active.where(account_id: account_ids).or(AccountUser.active.where(account_id: @domain_root_account.id)).select(:user_id))
                  .where(User.wildcard("users.name", term, type: :full))
                  .order(:sortable_name).limit(STAFF_LIMIT)
      render json: { staff: users.map { |user| { id: user.id.to_s, name: user.name } } }
    end

    private

    def editor
      @editor ||= PlanEditor.new(@current_user, @student, @domain_root_account, real_user:)
    end

    def render_student
      render json: PlanEditor.new(@current_user, @student, @domain_root_account, real_user:).as_json
    end

    def find_plan
      @plan = Plan.not_deleted.find_by(id: params[:id], root_account_id: @domain_root_account.id)
      return render json: { message: t("Plan not found.") }, status: :not_found unless @plan

      @student = @plan.student
    end

    def find_accommodation
      @accommodation = StudentAccommodation.active.find_by(id: params[:id], root_account_id: @domain_root_account.id)
      return render json: { message: t("Accommodation not found.") }, status: :not_found unless @accommodation

      @student = @accommodation.student
    end

    def plan_params
      params.permit(:plan_type, :start_date, :end_date, :case_manager_id, :notes, :workflow_state, :external_id, :account_id)
    end

    def accommodation_params
      params.permit(:accommodation_type_id, :start_date, :end_date, :teacher_note, :verified,
                    course_ids: [], parameters: %i[multiplier minutes percent mode attempts every_days setting])
    end

    def can_pick_staff?
      Account.where(id: @current_user.account_users.active.select(:account_id))
             .where("accounts.id = ? OR accounts.root_account_id = ?", @domain_root_account.id, @domain_root_account.id)
             .any? { |account| account.grants_right?(@current_user, :supports_manage_plans) }
    end
  end
end
