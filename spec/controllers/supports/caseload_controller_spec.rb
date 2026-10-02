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

describe Supports::CaseloadController do
  let_once(:root_account) { Account.default }
  let_once(:admin) { account_admin_user(account: root_account) }

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
  end

  before { user_session(admin) }

  def supports_env
    get :page
    assigns[:js_env][:SUPPORTS]
  end

  it "offers IEP scanning to someone who manages plans when the flag is on" do
    root_account.enable_feature!(:iep_scan)
    expect(supports_env).to include(can_scan: true, scan_account_id: root_account.id.to_s)
  end

  it "doesn't offer it while the flag is off" do
    expect(supports_env).to include(can_scan: false, scan_account_id: nil)
  end
end
