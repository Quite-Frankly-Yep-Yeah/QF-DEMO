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

describe SelfPaced::SkillsController do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }

  describe "GET show" do
    it "gives a teacher the skills" do
      user_session(teacher)
      get :show, params: { course_id: course.id }, format: :json

      expect(response).to be_successful
      expect(response.parsed_body).to include("students" => 1, "skills" => [])
    end

    it "keeps students out" do
      user_session(student)
      get :show, params: { course_id: course.id }, format: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST create" do
    it "adds a skill" do
      user_session(teacher)
      post :create, params: { course_id: course.id, title: "Read a bar graph", description: "From a table" }, format: :json

      expect(response).to have_http_status(:created)
      expect(course.learning_outcome_links.active.count).to eq 1
    end

    it "needs a name" do
      user_session(teacher)
      post :create, params: { course_id: course.id, title: "" }, format: :json

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "keeps students out" do
      user_session(student)
      post :create, params: { course_id: course.id, title: "Nope" }, format: :json

      expect(response).to have_http_status(:forbidden)
    end
  end
end
