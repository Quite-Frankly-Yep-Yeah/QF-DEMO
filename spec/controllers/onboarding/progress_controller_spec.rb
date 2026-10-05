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

describe Onboarding::ProgressController do
  let_once(:root_account) { Account.default }
  let_once(:site_admin) { site_admin_user }
  let_once(:teacher) { teacher_in_course(account: root_account, active_all: true).user }

  def json
    json_parse(response.body)
  end

  describe "for a site admin" do
    before { user_session(site_admin) }

    it "lists the installer checklist" do
      get :index
      expect(response).to be_successful
      expect(json["tracks"].pluck("key")).to eq ["install"]
      expect(json["tracks"].first).to include("url" => "/install_status", "total" => 5)
    end

    it "shows the installer checklist with its steps" do
      get :show, params: { track: "install" }
      expect(response).to be_successful
      expect(json["steps"].pluck("key")).to eq %w[domain mail jobs self_paced people ai_key demo_data]
    end

    it "marks a step done and starts the checklist over" do
      put :update, params: { track: "install", step: "mail", done: true }, as: :json
      expect(response).to be_successful
      expect(json["steps"].find { |s| s["key"] == "mail" }).to include("done" => true)

      delete :destroy, params: { track: "install" }
      expect(response).to be_successful
      expect(Onboarding::Progress.where(user: site_admin).count).to eq 0
    end

    it "accepts the string forms of booleans" do
      put :update, params: { track: "install", step: "mail", dismissed: "true" }
      expect(json["steps"].find { |s| s["key"] == "mail" }["dismissed_at"]).to be_present
    end

    it "refuses an unknown step" do
      put :update, params: { track: "install", step: "nope", done: true }, as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "for anyone else" do
    before { user_session(teacher) }

    it "lists no checklists" do
      get :index
      expect(json["tracks"]).to eq []
    end

    it "can't read or change the installer checklist" do
      get :show, params: { track: "install" }
      expect(response).to have_http_status(:not_found)

      put :update, params: { track: "install", step: "mail", done: true }, as: :json
      expect(response).to have_http_status(:not_found)
      expect(Onboarding::Progress.count).to eq 0
    end
  end

  it "requires a login" do
    get :index
    expect(response).not_to be_successful
  end
end
