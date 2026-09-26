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

# JSON API behind the teacher and mentor dashboard (docs/fork-plan.md
# feature C). Every action is limited to the courses in the viewer's
# SelfPaced::DashboardScope.
module SelfPaced
  class DashboardApiController < ApplicationController
    before_action :require_user

    # GET /api/v1/self_paced/roster?idle_minutes=5[&course_id=]
    def roster
      roster = Roster.new(scope, idle_minutes: params[:idle_minutes] || Roster::DEFAULT_IDLE_MINUTES, course_id: params[:course_id])
      render json: { rows: roster.rows }
    end

    # GET /api/v1/self_paced/courses/:course_id/students/:student_id
    def student
      course = scope.course(params[:course_id])
      return render_unauthorized_action unless course

      student = course.student_enrollments.active.where(user_id: params[:student_id]).first&.user
      return render json: { message: "student not found" }, status: :not_found unless student

      render json: StudentDetail.new(scope, course, student).as_json
    end

    # GET /api/v1/self_paced/courses/:course_id/summary
    #
    # The class as a whole for the course page (Phase 5b), with the viewer's
    # intervention tools for bulk actions.
    def course_summary
      course = scope.course(params[:course_id])
      return render_unauthorized_action unless course && scope.course_page?(course)

      render json: CourseSummary.new(scope, course).as_json.merge(tools: Intervener.new(course, @current_user).tools)
    end

    # PUT /api/v1/self_paced/caseload/:student_id
    def pin
      return render_unauthorized_action unless visible_student?

      MentorCaseload.create_or_find_by!(mentor: @current_user, student_id: params[:student_id], root_account: @domain_root_account)
      render json: { student_id: params[:student_id], pinned: true }
    end

    # DELETE /api/v1/self_paced/caseload/:student_id
    def unpin
      MentorCaseload.where(mentor: @current_user, student_id: params[:student_id], root_account: @domain_root_account).delete_all
      render json: { student_id: params[:student_id], pinned: false }
    end

    private

    def scope
      @scope ||= DashboardScope.new(@current_user)
    end

    # Staff can only pin students they can see on the dashboard.
    def visible_student?
      StudentCourseState.where(course_id: scope.courses.map(&:id), user_id: params[:student_id]).exists?
    end
  end
end
