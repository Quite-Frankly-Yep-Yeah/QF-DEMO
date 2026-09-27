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

describe SelfPaced::ParentFlyer do
  let(:root) { Account.default }

  describe ".code" do
    it "makes a code the first time and keeps it" do
      code = described_class.code(root)

      expect(code).to match(/\A[a-z0-9]{12}\z/)
      expect(described_class.code(Account.find(root.id))).to eql(code)
    end
  end

  describe ".reset!" do
    it "makes every earlier flyer stop working" do
      old = described_class.code(root)
      new_code = described_class.reset!(root)

      expect(new_code).not_to eql(old)
      expect(described_class.valid_code?(Account.find(root.id), old)).to be false
      expect(described_class.valid_code?(Account.find(root.id), new_code)).to be true
    end
  end

  describe ".valid_code?" do
    it "says no to a wrong, blank or missing code, even before one has been made" do
      expect(described_class.valid_code?(root, "anything")).to be false

      described_class.code(root)
      expect(described_class.valid_code?(root, "wrong")).to be false
      expect(described_class.valid_code?(root, "")).to be false
      expect(described_class.valid_code?(root, nil)).to be false
    end
  end

  describe ".build" do
    it "gives the sign-up address on the admin's own host, its QR code, and the school's name" do
      flyer = described_class.build(root, "https://lms.school.example/")

      expect(flyer[:url]).to eql("https://lms.school.example/parents/signup/#{described_class.code(root)}")
      expect(flyer[:school_name]).to eql(root.name)
      expect(flyer[:qr_svg]).to start_with("<svg").and include("QR code")
    end
  end
end
