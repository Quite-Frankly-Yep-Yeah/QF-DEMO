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

describe Supports::Roles do
  let(:root_account) { Account.default }

  describe ".ensure_case_manager!" do
    it "creates the role with its permissions, and is safe to run again" do
      role = described_class.ensure_case_manager!(root_account)
      expect(described_class.ensure_case_manager!(root_account)).to eql role
      enabled = root_account.role_overrides.where(role:, enabled: true).pluck(:permission)
      expect(enabled).to match_array described_class::CASE_MANAGER_PERMISSIONS.map(&:to_s)
    end
  end

  it "doesn't give either role the all-students permission" do
    expect(described_class::CASE_MANAGER_PERMISSIONS).not_to include :supports_view_all_students
    expect(described_class::SUPPORT_STAFF_PERMISSIONS).not_to include :supports_view_all_students
  end
end
