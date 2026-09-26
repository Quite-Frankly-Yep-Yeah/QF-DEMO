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

describe SelfPaced::PlayerController do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:tag) do
    course.context_modules.create!(name: "Unit 1").add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson").id)
  end

  def enable_player
    course.root_account.enable_feature!(:self_paced)
    course.enable_feature!(:self_paced_course_player)
  end

  describe "GET show" do
    it "renders the course map for a student" do
      enable_player
      user_session(student)
      get :show, params: { course_id: course.id }

      expect(response).to be_successful
      expect(controller.js_env[:SELF_PACED_PLAYER]).to include(map_url: "/api/v1/courses/#{course.id}/self_paced/map")
    end

    it "is off limits while the course player is off" do
      user_session(student)
      get :show, params: { course_id: course.id }

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET map" do
    it "returns the student's course map" do
      enable_player
      user_session(student)
      get :map, params: { course_id: course.id }, format: :json

      expect(response.parsed_body["units"].first["items"].first).to include("title" => "Lesson")
    end
  end
end
