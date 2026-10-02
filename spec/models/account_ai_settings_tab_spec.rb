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

describe Account do
  describe "#tabs_available" do
    let_once(:root_account) { Account.default }
    let_once(:admin) { account_admin_user(account: root_account) }
    let_once(:teacher) { teacher_in_course(account: root_account, active_all: true).user }
    let_once(:sub_account) { root_account.sub_accounts.create!(name: "Lincoln High") }

    def css_classes(account, user)
      account.tabs_available(user).pluck(:css_class)
    end

    before :once do
      root_account.enable_feature!(:student_supports)
    end

    it "is offered to an admin of a school with IEP scanning on" do
      root_account.enable_feature!(:iep_scan)
      tab = root_account.tabs_available(admin).find { |t| t[:css_class] == "ai_settings" }
      expect(tab).to include(label: "AI settings", href: :account_ai_settings_path)
    end

    it "isn't offered while IEP scanning is off" do
      expect(css_classes(root_account, admin)).not_to include("ai_settings")
    end

    it "isn't offered to someone who can't manage the account's settings" do
      root_account.enable_feature!(:iep_scan)
      expect(css_classes(root_account, teacher)).not_to include("ai_settings")
    end

    it "isn't offered on a sub-account" do
      root_account.enable_feature!(:iep_scan)
      expect(css_classes(sub_account, account_admin_user(account: sub_account))).not_to include("ai_settings")
    end

    it "is offered to a site admin on the site admin account, flag or no flag" do
      expect(css_classes(Account.site_admin, site_admin_user)).to include("ai_settings")
    end
  end
end
