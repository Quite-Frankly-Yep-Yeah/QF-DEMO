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

# Attendance rules and corrections (docs/fork-plan.md §2.10). School admins
# set the policy; staff who can grade correct a student's day.
module SelfPaced
  class AttendanceController < ApplicationController
    before_action :require_user
    before_action :require_reports_on

    # GET /api/v1/self_paced/attendance_policies
    def policies
      return render_unauthorized_action unless DashboardScope.new(@current_user).allowed? || admin?

      render json: { policies: AttendancePolicy.where(root_account: @domain_root_account).order(:effective_on).map(&:as_json_for_api) }
    end

    # POST /api/v1/self_paced/attendance_policies
    #   effective_on, min_active_minutes, submission_counts, notes
    def create_policy
      return render_unauthorized_action unless admin?

      policy = AttendancePolicy.new(params.permit(:effective_on, :min_active_minutes, :submission_counts, :notes))
      policy.root_account = @domain_root_account
      policy.created_by = @current_user
      if policy.save
        render json: policy.as_json_for_api, status: :created
      else
        render json: { errors: policy.errors.full_messages }, status: :unprocessable_content
      end
    end

    # GET /api/v1/courses/:course_id/self_paced/attendance_adjustments[?student_id=]
    def adjustments
      course = staff_course
      return render_unauthorized_action unless course

      scope = AttendanceAdjustment.where(course:).order(day: :desc, id: :desc).preload(:created_by)
      scope = scope.where(student_id: params[:student_id]) if params[:student_id].present?
      render json: { adjustments: scope.map(&:as_json_for_api) }
    end

    # POST /api/v1/courses/:course_id/self_paced/attendance_adjustments
    #   student_id, day, present, minutes, reason
    def create_adjustment
      course = staff_course
      return render_unauthorized_action unless course&.grants_right?(@current_user, :manage_grades)

      student = course.student_enrollments.active.find_by(user_id: params[:student_id])&.user
      return render json: { message: "student not found" }, status: :not_found unless student

      adjustment = AttendanceAdjustment.new(params.permit(:day, :present, :minutes, :reason))
      adjustment.assign_attributes(course:, student:, created_by: @current_user)
      if adjustment.save
        render json: adjustment.as_json_for_api, status: :created
      else
        render json: { errors: adjustment.errors.full_messages }, status: :unprocessable_content
      end
    end

    private

    def require_reports_on
      render_unauthorized_action unless SelfPaced.feature_enabled?(@domain_root_account, :self_paced_reports)
    end

    def admin?
      @domain_root_account.grants_right?(@current_user, :manage_account_settings)
    end

    def staff_course
      DashboardScope.new(@current_user).course(params[:course_id])
                    .then { |course| course if course && SelfPaced.feature_enabled?(course, :self_paced_reports) }
    end
  end
end
