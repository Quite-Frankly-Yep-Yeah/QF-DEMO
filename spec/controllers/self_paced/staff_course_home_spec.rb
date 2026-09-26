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
describe CoursesController do
  describe "GET show for a self-paced course" do
    let_once(:course) { course_factory(active_all: true) }
    let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
    let_once(:student) { student_in_course(course:, active_all: true).user }

    before do
      course.root_account.enable_feature!(:self_paced)
      course.enable_feature!(:self_paced_course_player)
    end

    it "gives teachers the staff home" do
      user_session(teacher)
      get :show, params: { id: course.id }

      expect(response).to be_successful
      expect(controller.js_env[:SELF_PACED_COURSE_HOME][:course]).to include(name: course.name)
      expect(controller.js_env[:SELF_PACED_COURSE_HOME][:classic_url]).to eql("/courses/#{course.id}?classic=1")
    end

    it "gives admins the staff home" do
      user_session(account_admin_user(account: course.root_account))
      get :show, params: { id: course.id }

      expect(controller.js_env).to have_key(:SELF_PACED_COURSE_HOME)
    end

    it "opens the standard page with ?classic=1" do
      user_session(teacher)
      get :show, params: { id: course.id, classic: "1" }

      expect(controller.js_env).not_to have_key(:SELF_PACED_COURSE_HOME)
    end

    it "still sends students to the course map" do
      user_session(student)
      get :show, params: { id: course.id }

      expect(response).to redirect_to(course_self_paced_player_path(course))
    end

    it "leaves courses without the player alone" do
      course.disable_feature!(:self_paced_course_player)
      user_session(teacher)
      get :show, params: { id: course.id }

      expect(controller.js_env).not_to have_key(:SELF_PACED_COURSE_HOME)
    end
  end
end
