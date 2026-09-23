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

describe SelfPaced::DashboardController do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }

  def enable_dashboard
    course.root_account.enable_feature!(:self_paced)
    course.root_account.enable_feature!(:self_paced_activity_tracking)
    course.root_account.enable_feature!(:self_paced_teacher_dashboard)
  end

  describe "GET show" do
    it "renders the dashboard app for a teacher" do
      enable_dashboard
      user_session(teacher)
      get :show

      expect(response).to be_successful
      expect(controller.js_env[:SELF_PACED_DASHBOARD]).to include(roster_url: "/api/v1/self_paced/roster", course_id: nil)
    end

    it "is off limits to students" do
      enable_dashboard
      user_session(student)
      get :show

      expect(response).to have_http_status(:unauthorized)
    end

    it "is off limits while the dashboard is off" do
      user_session(teacher)
      get :show

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET course" do
    it "opens the dashboard filtered to the course" do
      enable_dashboard
      user_session(teacher)
      get :course, params: { course_id: course.id }

      expect(controller.js_env[:SELF_PACED_DASHBOARD]).to include(course_id: course.id.to_s)
    end
  end
end
