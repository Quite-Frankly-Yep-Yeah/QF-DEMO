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
  let_once(:root_account) { Account.create! }
  let_once(:school) { root_account.sub_accounts.create!(name: "North High") }
  let_once(:course) { course_factory(account: school, active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }

  def enable_dashboard
    root_account.enable_feature!(:self_paced)
    root_account.enable_feature!(:self_paced_activity_tracking)
    root_account.enable_feature!(:self_paced_teacher_dashboard)
  end

  describe "GET show" do
    it "renders the dashboard app for a teacher, across all their courses" do
      enable_dashboard
      user_session(teacher)
      get :show

      expect(response).to be_successful
      expect(controller.js_env[:SELF_PACED_DASHBOARD]).to include(roster_url: "/api/v1/self_paced/roster", course_id: nil)
    end

    it "opens filtered to one course when asked" do
      enable_dashboard
      user_session(teacher)
      get :show, params: { course_id: course.id }

      expect(controller.js_env[:SELF_PACED_DASHBOARD]).to include(course_id: course.id.to_s)
    end

    it "ignores a course filter for a course the viewer can't see" do
      enable_dashboard
      user_session(teacher)
      get :show, params: { course_id: course_factory(active_all: true).id }

      expect(controller.js_env[:SELF_PACED_DASHBOARD]).to include(course_id: nil)
    end

    it "opens for a school mentor before any of their students are tracked" do
      enable_dashboard
      mentor = user_factory(active_all: true)
      school.account_users.create!(user: mentor, role: SelfPaced::MentorRole.ensure!(root_account))
      user_session(mentor)
      get :show

      expect(response).to be_successful
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
end
