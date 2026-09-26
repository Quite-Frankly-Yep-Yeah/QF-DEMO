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

describe OutcomesController do
  describe "GET index for a self-paced course" do
    let_once(:course) { course_factory(active_all: true) }
    let_once(:teacher) { teacher_in_course(course:, active_all: true).user }

    before do
      course.root_account.enable_feature!(:self_paced)
      course.enable_feature!(:self_paced_course_player)
    end

    it "gives teachers the Skills page" do
      user_session(teacher)
      get :index, params: { course_id: course.id }

      expect(controller.js_env[:SELF_PACED_SKILLS]).to include(
        skills_url: "/api/v1/courses/#{course.id}/self_paced/skills",
        can_add: true,
        classic_url: "/courses/#{course.id}/outcomes?classic=1"
      )
    end

    it "opens the standard page with ?classic=1" do
      user_session(teacher)
      get :index, params: { course_id: course.id, classic: "1" }

      expect(controller.js_env).not_to have_key(:SELF_PACED_SKILLS)
    end

    it "leaves courses without the player alone" do
      course.disable_feature!(:self_paced_course_player)
      user_session(teacher)
      get :index, params: { course_id: course.id }

      expect(controller.js_env).not_to have_key(:SELF_PACED_SKILLS)
    end
  end
end
