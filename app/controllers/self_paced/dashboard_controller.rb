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

# The teacher and mentor dashboard page (docs/fork-plan.md feature C), reached
# from "Students" in the global navigation. The page is a React app
# (ui/features/self_paced_dashboard) that reads SelfPaced::DashboardApiController.
#
# /self_paced/dashboard?course_id=4 opens it filtered to one course.
module SelfPaced
  class DashboardController < ApplicationController
    before_action :require_user

    def show
      scope = DashboardScope.new(@current_user)
      return render_unauthorized_action unless scope.allowed?

      @page_title = t("Students")
      js_env({ SELF_PACED_DASHBOARD: {
               roster_url: api_v1_self_paced_roster_path,
               # templates; the app fills in the ids
               student_url: "/api/v1/self_paced/courses/:course_id/students/:student_id",
               caseload_url: "/api/v1/self_paced/caseload/:student_id",
               course_id: scope.course(params[:course_id])&.id&.to_s,
               idle_minutes: Roster::DEFAULT_IDLE_MINUTES,
               poll_seconds: 30
             } })
      js_bundle :self_paced_dashboard
      render html: '<div id="self_paced_dashboard"></div>'.html_safe, layout: true
    end
  end
end
