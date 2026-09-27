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

# Where the global "Admin" item goes (ApplicationController#admin_hub_nav_path)
describe ApplicationController do
  describe "#admin_hub_nav_path" do
    let(:root) { Account.default }

    def nav_path_for(user, domain_root_account = root)
      controller.instance_variable_set(:@domain_root_account, domain_root_account)
      controller.instance_variable_set(:@current_user, user)
      controller.remove_instance_variable(:@admin_hub_nav_path) if controller.instance_variable_defined?(:@admin_hub_nav_path)
      controller.send(:admin_hub_nav_path)
    end

    it "is this school's admin hub for someone who administers the school" do
      expect(nav_path_for(account_admin_user(account: root))).to eql("/accounts/#{root.id}/hub")
    end

    it "is nothing for a teacher, a student or someone signed out, who keep the plain link" do
      expect(nav_path_for(course_with_teacher(account: root).user)).to be_nil
      expect(nav_path_for(student_in_course(active_all: true).user)).to be_nil
      expect(nav_path_for(nil)).to be_nil
    end

    it "is nothing for someone who only administers another account" do
      elsewhere = Account.create!(name: "Elsewhere")

      expect(nav_path_for(account_admin_user(account: elsewhere))).to be_nil
    end

    it "is the hub of the school being looked at, for an admin of several" do
      other = Account.create!(name: "Other school")
      both = account_admin_user(account: root)
      account_admin_user(user: both, account: other)

      expect(nav_path_for(both, other)).to eql("/accounts/#{other.id}/hub")
      expect(nav_path_for(both, root)).to eql("/accounts/#{root.id}/hub")
    end

    it "is nothing when there is no school to look at, as on some public pages" do
      expect(nav_path_for(account_admin_user(account: root), nil)).to be_nil
    end
  end
end
