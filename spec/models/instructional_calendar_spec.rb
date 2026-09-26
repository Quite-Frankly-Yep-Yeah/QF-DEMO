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

describe InstructionalCalendar do
  let_once(:school) { Account.default.sub_accounts.create!(name: "School") }

  describe "validation" do
    it "needs seven whole weekdays" do
      calendar = described_class.new(account: school, weekday_minutes: [0, 360, 360])

      expect(calendar).not_to be_valid
      expect(calendar.errors[:weekday_minutes]).to be_present
    end

    it "rejects dates that aren't dates" do
      calendar = described_class.new(account: school, date_minutes: { "next tuesday" => 180 })

      expect(calendar).not_to be_valid
      expect(calendar.errors[:date_minutes]).to be_present
    end

    it "fills in the root account" do
      expect(described_class.create!(account: school).root_account).to eql(Account.default)
    end
  end

  describe ".for_account" do
    it "finds the school's own calendar before a parent's" do
      district = described_class.create!(account: Account.default)
      expect(described_class.for_account(school)).to eql(district)

      own = described_class.create!(account: school)
      expect(described_class.for_account(school)).to eql(own)
    end
  end
end
