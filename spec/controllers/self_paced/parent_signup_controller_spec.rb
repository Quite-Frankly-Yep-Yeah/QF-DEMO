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

describe SelfPaced::ParentSignupController do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let(:code) { maya.generate_observer_pairing_code.code }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.root_account.enable_feature!(:self_paced_observer_view)
  end

  describe "GET show" do
    it "shows the sign-up page to someone who isn't signed in, naming only the student's first name" do
      get :show, params: { code: }

      expect(response).to be_successful
      env = controller.js_env[:SELF_PACED_PARENT_SIGNUP]
      expect(env).to include(valid: true, student_first_name: "Maya", signed_in_as: nil, submit_url: "/parents/join/#{code}")
      expect(env.to_json).not_to include("Lopez")
    end

    it "says the code is no good when it is unknown or has expired" do
      get :show, params: { code: "nope" }

      expect(controller.js_env[:SELF_PACED_PARENT_SIGNUP]).to include(valid: false, student_first_name: nil)
    end

    it "offers to add the student to the account of someone already signed in" do
      parent = user_with_pseudonym(active_all: true)
      user_session(parent)
      get :show, params: { code: }

      expect(controller.js_env[:SELF_PACED_PARENT_SIGNUP]).to include(signed_in_as: parent.name)
    end

    it "isn't there while the observer view is off" do
      course.root_account.disable_feature!(:self_paced_observer_view)
      get :show, params: { code: }

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST create" do
    let(:details) { { name: "Pat Kim", email: "pat@example.com", password: "longenough1", password_confirmation: "longenough1" } }

    it "makes the account, links it to the student and signs them in" do
      post :create, params: { code: }.merge(details), format: :json

      expect(response).to be_successful
      expect(response.parsed_body["redirect"]).to eql("/")
      parent = Pseudonym.active.by_unique_id("pat@example.com").first.user
      expect(UserObservationLink.active.where(student: maya, observer: parent)).to exist
      expect(session[:pseudonym_credentials_id] || controller.session["pseudonym_credentials"]).to be_present
    end

    it "gives a used code no second life" do
      post :create, params: { code: }.merge(details), format: :json
      post :create, params: { code: }.merge(details, email: "other@example.com"), format: :json

      expect(response).to have_http_status(:not_found)
    end

    it "explains what is wrong with the details" do
      post :create, params: { code: }.merge(details, email: "nope"), format: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].join).to match(/email/i)
    end

    it "adds the student to the account of someone who is signed in" do
      parent = user_with_pseudonym(active_all: true)
      user_session(parent)
      post :create, params: { code: }, format: :json

      expect(response).to be_successful
      expect(UserObservationLink.active.where(student: maya, observer: parent)).to exist
    end
  end
end
