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

# The Parents tab in an account's sidebar (Account#tabs_available)
describe "the Parents tab in the account sidebar" do
  let_once(:root) { Account.default }
  let_once(:admin) { account_admin_user(account: root) }

  def parents_tab(user = admin, account = Account.find(root.id))
    account.tabs_available(user).find { |tab| tab[:css_class] == "self_paced_parents" }
  end

  context "with the parent view on" do
    before do
      root.enable_feature!(:self_paced)
      root.enable_feature!(:self_paced_observer_view)
    end

    it "is there for an admin who can manage observers, and goes to the Parents page" do
      expect(parents_tab).to include(id: Account::TAB_SELF_PACED_PARENTS, label: "Parents", href: :self_paced_parents_page_path, no_args: true)
    end

    it "sits right after People" do
      classes = root.tabs_available(admin).pluck(:css_class)

      expect(classes.index("self_paced_parents")).to eq(classes.index("users") + 1)
    end

    it "says how many requests are waiting" do
      course = course_factory(active_all: true)
      2.times do |i|
        student = student_in_course(course:, active_all: true, name: "Kid #{i}").user
        SelfPaced::LinkRequest.ask!(observer: user_factory(active_all: true), student:, root_account: root)
      end

      expect(parents_tab[:label]).to eql("Parents (2 waiting)")
    end

    it "doesn't count answered, taken-back or another school's requests" do
      course = course_factory(active_all: true)
      student = student_in_course(course:, active_all: true).user
      SelfPaced::LinkRequest.ask!(observer: user_factory(active_all: true), student:, root_account: root).decline!(admin)
      SelfPaced::LinkRequest.ask!(observer: user_factory(active_all: true), student:, root_account: root).cancel!
      SelfPaced::LinkRequest.ask!(observer: user_factory(active_all: true), student:, root_account: Account.create!(name: "Other school"))

      expect(parents_tab[:label]).to eql("Parents")
    end

    it "isn't there for an admin whose role can't manage observers" do
      role = custom_account_role("No observers", account: root)
      root.role_overrides.create!(permission: "manage_user_observers", role:, enabled: false)
      limited = account_admin_user(account: root, role:)

      expect(parents_tab(limited)).to be_nil
    end

    it "isn't there for someone who isn't an admin, or for nobody" do
      teacher = course_with_teacher(account: root).user

      expect(parents_tab(teacher)).to be_nil
      expect(Account.find(root.id).tabs_available(nil).pluck(:css_class)).not_to include("self_paced_parents")
    end

    it "isn't on a sub-account, since parents belong to the whole school" do
      sub = root.sub_accounts.create!(name: "Sub")
      sub_admin = account_admin_user(account: sub)

      expect(parents_tab(sub_admin, sub)).to be_nil
    end
  end

  it "isn't there while the parent view is off" do
    expect(parents_tab).to be_nil

    root.enable_feature!(:self_paced)
    expect(parents_tab).to be_nil
  end
end
