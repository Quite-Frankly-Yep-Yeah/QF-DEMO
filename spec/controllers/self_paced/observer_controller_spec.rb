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

describe SelfPaced::ObserverController do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:jordan) { student_in_course(course:, active_all: true, name: "Jordan Kim").user }
  let_once(:parent) { observer_in_course(course:, associated_user_id: maya.id, active_all: true).user }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.root_account.enable_feature!(:self_paced_observer_view)
    course.enable_feature!(:self_paced_course_player)
  end

  describe "GET show" do
    it "renders the observer page" do
      user_session(parent)
      get :show

      expect(response).to be_successful
      expect(controller.js_env[:SELF_PACED_OBSERVER]).to include(data_url: "/api/v1/self_paced/observer", classic_url: "/?classic=1")
    end

    it "is off limits while the observer view is off" do
      course.root_account.disable_feature!(:self_paced_observer_view)
      user_session(parent)
      get :show

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET data" do
    it "gives an observer only the students they follow" do
      user_session(parent)
      get :data, format: :json

      expect(response).to be_successful
      expect(response.parsed_body["students"].pluck("name")).to eql(["Maya Lopez"])
    end

    it "gives someone with nobody linked an empty list, not another family's students" do
      user_session(user_factory(active_all: true))
      get :data, format: :json

      expect(response.parsed_body["students"]).to eql([])
    end

    it "gives a student no view of classmates" do
      user_session(jordan)
      get :data, format: :json

      expect(response.parsed_body["students"]).to eql([])
    end
  end
end

describe UsersController, "observer home" do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:maya) { student_in_course(course:, active_all: true).user }
  let_once(:parent) { observer_in_course(course:, associated_user_id: maya.id, active_all: true).user }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.root_account.enable_feature!(:self_paced_observer_view)
    course.enable_feature!(:self_paced_course_player)
  end

  it "opens the observer view for someone who only observes" do
    user_session(parent)
    get :user_dashboard

    expect(controller.js_env[:SELF_PACED_OBSERVER]).to include(data_url: "/api/v1/self_paced/observer")
  end

  it "opens the classic dashboard with ?classic=1" do
    user_session(parent)
    get :user_dashboard, params: { classic: "1" }

    expect(controller.js_env).not_to have_key(:SELF_PACED_OBSERVER)
  end
end
