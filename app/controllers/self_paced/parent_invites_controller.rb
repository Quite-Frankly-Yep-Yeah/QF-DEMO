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

# Makes a parent invitation (a link and QR code) for a student, for staff on
# the Students page and admins on the People page (docs/fork-plan.md).
module SelfPaced
  class ParentInvitesController < ApplicationController
    before_action :require_user

    # POST /api/v1/self_paced/students/:student_id/parent_invite
    def create
      return render_unauthorized_action unless SelfPaced.feature_enabled?(@domain_root_account, :self_paced_observer_view)

      student = User.active.find_by(id: params[:student_id])
      return render json: { message: "student not found" }, status: :not_found unless student && student_enrollment?(student)
      return render_unauthorized_action unless can_invite_for?(student)

      render json: ParentInvite.create(student, request.base_url)
    end

    private

    def student_enrollment?(student)
      student.student_enrollments.active.exists?
    end

    # Staff who can see the student on the dashboard, and admins who manage
    # students in this school.
    def can_invite_for?(student)
      courses = DashboardScope.new(@current_user).courses
      return true if student.student_enrollments.active.where(course_id: courses.map(&:id)).exists?

      @domain_root_account.grants_right?(@current_user, session, :manage_students)
    end
  end
end
