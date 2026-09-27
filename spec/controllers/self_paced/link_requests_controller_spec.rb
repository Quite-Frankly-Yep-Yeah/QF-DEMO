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

describe SelfPaced::LinkRequestsController do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:parent) { user_factory(active_all: true, name: "Pat Kim") }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.root_account.enable_feature!(:self_paced_observer_view)
    course.enable_feature!(:self_paced_course_player)
  end

  describe "GET search" do
    it "finds a student by their name" do
      user_session(parent)
      get :search, params: { q: "maya lopez" }, format: :json

      expect(response).to be_successful
      expect(response.parsed_body["students"]).to eql([{ "id" => maya.id.to_s, "name" => "Maya Lopez" }])
    end

    it "answers a search that's too short with nobody, without looking" do
      user_session(parent)
      expect(SelfPaced::StudentFinder).not_to receive(:new)
      get :search, params: { q: "maya" }, format: :json

      expect(response.parsed_body["students"]).to eql([])
    end

    it "slows down someone who keeps searching" do
      enable_cache do
        user_session(parent)
        stub_const("SelfPaced::LinkRequestsController::SEARCHES_PER_HOUR", 2)
        2.times { get :search, params: { q: "maya lopez" }, format: :json }
        get :search, params: { q: "maya lopez" }, format: :json

        expect(response).to have_http_status(:too_many_requests)
      end
    end

    it "is closed to students, who could otherwise look up their classmates" do
      user_session(maya)
      get :search, params: { q: "maya lopez" }, format: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "is closed to teachers, and so is everything else here" do
      user_session(teacher_in_course(course:, active_all: true).user)
      get :search, params: { q: "maya lopez" }, format: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "needs someone signed in" do
      get :search, params: { q: "maya lopez" }, format: :json

      expect(response).to have_http_status(:unauthorized)
    end

    it "is closed while the observer view is off" do
      course.root_account.disable_feature!(:self_paced_observer_view)
      user_session(parent)
      get :search, params: { q: "maya lopez" }, format: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST create" do
    before { user_session(parent) }

    it "asks the school to link the parent, and links no one yet" do
      post :create, params: { student_id: maya.id, note: "I'm her mother" }, format: :json

      expect(response).to have_http_status(:created)
      expect(response.parsed_body).to include("status" => "pending", "note" => "I'm her mother")
      expect(response.parsed_body["student"]).to eql("id" => maya.id.to_s, "name" => "Maya Lopez")
      expect(SelfPaced::LinkRequest.where(observer: parent, student: maya)).to exist
      expect(UserObservationLink.where(observer: parent)).to be_empty
    end

    it "says why when it can't be asked" do
      post :create, params: { student_id: maya.id }, format: :json
      post :create, params: { student_id: maya.id }, format: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["message"]).to match(/already asked/)
    end

    it "won't take a student the search wouldn't have shown" do
      course.disable_feature!(:self_paced_course_player)
      post :create, params: { student_id: maya.id }, format: :json

      expect(response).to have_http_status(:not_found)
      expect(SelfPaced::LinkRequest.count).to eq 0
    end

    it "won't take an id that isn't a student" do
      post :create, params: { student_id: 0 }, format: :json

      expect(response).to have_http_status(:not_found)
    end

    it "is closed to students" do
      user_session(maya)
      post :create, params: { student_id: maya.id }, format: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE destroy" do
    it "lets the parent take back a waiting request" do
      request = SelfPaced::LinkRequest.ask!(observer: parent, student: maya, root_account: course.root_account)
      user_session(parent)
      delete :destroy, params: { id: request.id }, format: :json

      expect(response).to be_successful
      expect(request.reload.workflow_state).to eql("cancelled")
    end

    it "won't touch someone else's request" do
      request = SelfPaced::LinkRequest.ask!(observer: parent, student: maya, root_account: course.root_account)
      user_session(user_factory(active_all: true))
      delete :destroy, params: { id: request.id }, format: :json

      expect(response).to have_http_status(:not_found)
      expect(request.reload).to be_pending
    end
  end
end
