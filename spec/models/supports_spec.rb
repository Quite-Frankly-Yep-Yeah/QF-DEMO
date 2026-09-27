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

describe Supports do
  let(:root_account) { Account.default }
  let(:school) { root_account.sub_accounts.create!(name: "Lincoln High") }

  describe ".record_mode" do
    it "is the classroom layer by default" do
      expect(described_class.record_mode(school)).to eql "classroom_layer"
    end

    it "is inherited from the parent account" do
      root_account.settings[:supports_record_mode] = { value: "system_of_record" }
      root_account.save!
      expect(described_class.record_mode(school.reload)).to eql "system_of_record"
      expect(described_class.system_of_record?(school)).to be true
    end

    it "falls back to the default for an unknown value" do
      school.settings[:supports_record_mode] = { value: "nonsense" }
      expect(described_class.record_mode(school)).to eql "classroom_layer"
    end
  end

  describe ".enabled?" do
    it "follows the root account's umbrella flag" do
      course = course_factory(account: school)
      expect(described_class.enabled?(course)).to be false
      root_account.enable_feature!(:student_supports)
      expect(described_class.enabled?(Course.find(course.id))).to be true
    end
  end
end
