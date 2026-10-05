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

describe Onboarding::InstallStatusController do
  it "renders the page for a site admin" do
    user_session(site_admin_user)
    get :show
    expect(response).to be_successful
    expect(controller.js_env[:INSTALL_STATUS]).to eq({ track: "install" })
  end

  it "refuses a school admin" do
    user_session(account_admin_user(account: Account.default))
    get :show
    expect(response).to be_unauthorized
  end
end
