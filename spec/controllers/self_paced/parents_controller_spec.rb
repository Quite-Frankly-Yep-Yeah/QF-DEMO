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

describe SelfPaced::ParentsController do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:root) { course.root_account }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:parent) { user_factory(active_all: true, name: "Pat Kim") }
  let_once(:admin) { account_admin_user(account: root) }
  let(:request_row) { SelfPaced::LinkRequest.ask!(observer: parent, student: maya, root_account: root, note: "Her mom") }

  before do
    root.enable_feature!(:self_paced)
    root.enable_feature!(:self_paced_observer_view)
    course.enable_feature!(:self_paced_course_player)
  end

  describe "who can use it" do
    it "is for admins who can manage observers" do
      user_session(admin)
      get :show

      expect(response).to be_successful
      expect(controller.js_env[:SELF_PACED_PARENTS]).to include(requests_url: "/api/v1/self_paced/parents/requests")
    end

    it "is closed to teachers, students and parents, whatever the endpoint" do
      request_row
      [teacher_in_course(course:, active_all: true).user, maya, parent].each do |user|
        user_session(user)
        get :show
        expect(response).to have_http_status(:unauthorized)
        get :flyer, format: :json
        expect(response).to have_http_status(:forbidden)
        get :requests, format: :json
        expect(response).to have_http_status(:forbidden)
        post :approve, params: { id: request_row.id }, format: :json
        expect(response).to have_http_status(:forbidden)
        post :reset_flyer, format: :json
        expect(response).to have_http_status(:forbidden)
      end
      expect(UserObservationLink.where(observer: parent)).to be_empty
    end

    it "is closed to an admin whose role can't manage observers" do
      role = custom_account_role("No observers", account: root)
      limited = account_admin_user(account: root, role:)
      root.role_overrides.create!(permission: "manage_user_observers", role:, enabled: false)
      user_session(limited)
      get :requests, format: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "is closed while the observer view is off" do
      root.disable_feature!(:self_paced_observer_view)
      user_session(admin)
      get :requests, format: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "the flyer" do
    before { user_session(admin) }

    it "gives the address and QR code for the school's sign-up" do
      get :flyer, format: :json

      expect(response.parsed_body["url"]).to eql("http://test.host/parents/signup/#{SelfPaced::ParentFlyer.code(Account.find(root.id))}")
      expect(response.parsed_body["qr_svg"]).to start_with("<svg")
      expect(response.parsed_body["school_name"]).to eql(root.name)
    end

    it "can be reset, which kills the old code" do
      old = SelfPaced::ParentFlyer.code(root)
      post :reset_flyer, format: :json

      expect(response.parsed_body["url"]).not_to include(old)
      expect(SelfPaced::ParentFlyer.valid_code?(Account.find(root.id), old)).to be false
    end
  end

  describe "GET requests" do
    before { user_session(admin) }

    it "lists what's waiting, with what an admin needs to decide" do
      request_row
      get :requests, format: :json

      row = response.parsed_body["requests"].first
      expect(row).to include("status" => "pending", "note" => "Her mom")
      expect(row["observer"]).to include("name" => "Pat Kim")
      expect(row["student"]).to include("name" => "Maya Lopez", "classes" => ["Algebra 1"])
    end

    it "puts waiting requests first, keeps recent answers, and drops old ones and taken-back ones" do
      jordan = student_in_course(course:, active_all: true, name: "Jordan Kim").user
      old = SelfPaced::LinkRequest.ask!(observer: parent, student: jordan, root_account: root).decline!(admin)
      old.update!(decided_at: 2.months.ago)
      answered = request_row.decline!(admin)
      waiting = SelfPaced::LinkRequest.ask!(observer: parent, student: student_in_course(course:, active_all: true, name: "Sam Kim").user, root_account: root)
      SelfPaced::LinkRequest.ask!(observer: parent, student: student_in_course(course:, active_all: true, name: "Lee Kim").user, root_account: root).cancel!

      get :requests, format: :json

      expect(response.parsed_body["requests"].pluck("id")).to eql([waiting.id.to_s, answered.id.to_s])
    end

    it "doesn't show another school's requests" do
      other_root = Account.create!(name: "Other school")
      SelfPaced::LinkRequest.ask!(observer: parent, student: maya, root_account: other_root)
      get :requests, format: :json

      expect(response.parsed_body["requests"]).to be_empty
    end
  end

  describe "POST approve" do
    before { user_session(admin) }

    it "links the parent to the student and records who did it" do
      post :approve, params: { id: request_row.id }, format: :json

      expect(response).to be_successful
      expect(response.parsed_body).to include("status" => "approved", "decided_by" => admin.name)
      expect(UserObservationLink.active.where(student: maya, observer: parent)).to exist
    end

    it "says so when someone else answered first" do
      request_row.decline!(admin)
      post :approve, params: { id: request_row.id }, format: :json

      expect(response).to have_http_status(:conflict)
      expect(UserObservationLink.where(observer: parent)).to be_empty
    end

    it "can't approve another school's request" do
      other = SelfPaced::LinkRequest.ask!(observer: parent, student: maya, root_account: Account.create!(name: "Other school"))
      post :approve, params: { id: other.id }, format: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST decline" do
    before { user_session(admin) }

    it "turns the request down, with a reason the parent will see" do
      post :decline, params: { id: request_row.id, response: "Please call the office." }, format: :json

      expect(response.parsed_body).to include("status" => "declined", "response" => "Please call the office.")
      expect(UserObservationLink.where(observer: parent)).to be_empty
    end
  end
end
