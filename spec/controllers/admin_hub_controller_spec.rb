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

describe AdminHubController do
  let_once(:account) { Account.default }
  let_once(:admin) { account_admin_user(account:) }
  let_once(:teacher) { course_with_teacher(account:).user }

  describe "GET show" do
    it "redirects a visitor to log in" do
      get :show, params: { account_id: account.id }
      expect(response).to be_redirect
    end

    it "is unauthorized for a user who isn't an admin" do
      user_session(teacher)
      get :show, params: { account_id: account.id }
      assert_unauthorized
    end

    context "as an admin" do
      before { user_session(admin) }

      it "renders the page with the hub config" do
        get :show, params: { account_id: account.id }
        expect(response).to be_successful
        config = assigns[:js_env][:ADMIN_HUB]
        expect(config[:account]).to eql({ id: account.id.to_s, name: account.name })
        expect(config[:tabs].pluck(:css_class)).to include("permissions", "users")
      end

      it "lists the settings tabs the admin can open, as deep links" do
        get :show, params: { account_id: account.id }
        tabs = assigns[:js_env][:ADMIN_HUB][:settings_tabs]
        expect(tabs.pluck(:id)).to include("settings", "users", "announcements")
        expect(tabs.first[:path]).to eql("/accounts/#{account.id}/settings#tab-settings")
      end

      it "only offers the teacher dashboard when its flag is on" do
        get :show, params: { account_id: account.id }
        expect(assigns[:js_env][:ADMIN_HUB][:self_paced]).to be_empty

        account.enable_feature!(:self_paced_teacher_dashboard)
        get :show, params: { account_id: account.id }
        expect(assigns[:js_env][:ADMIN_HUB][:self_paced].pluck(:id)).to eql(["dashboard"])
      end
    end
  end
end
