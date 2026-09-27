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

describe Supports::AccessLog do
  let_once(:root_account) { Account.default }
  let_once(:viewer) { user_factory }
  let_once(:student) { user_factory }

  describe ".record!" do
    it "writes a row that can't be changed afterwards" do
      described_class.record!(viewer:, student:, tier: 1, subject: :accommodations, root_account:)
      row = described_class.last
      expect { row.update!(tier: 2) }.to raise_error(ActiveRecord::ReadOnlyRecord)
    end

    it "doesn't store the viewer as their own real user" do
      described_class.record!(viewer:, student:, tier: 1, subject: :accommodations, root_account:, real_user: viewer)
      expect(described_class.last.real_user_id).to be_nil
    end
  end
end
