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

describe Supports::NameMatch do
  describe ".words" do
    it "lowercases and keeps only the alphabetic words" do
      expect(described_class.words("Student, Pat Q.")).to eq %w[student pat q]
      expect(described_class.words(nil)).to eq []
    end
  end

  describe ".exact?" do
    it "ignores order, case, spacing and punctuation" do
      expect(described_class.exact?("Pat Student", "student  PAT")).to be true
      expect(described_class.exact?("Student, Pat", "Pat Student")).to be true
    end

    it "is false for different words, and never true for blanks" do
      expect(described_class.exact?("Pat Student", "Pat Other")).to be false
      expect(described_class.exact?("", "")).to be false
      expect(described_class.exact?(nil, "Pat")).to be false
    end
  end

  describe ".partial?" do
    it "is true when one name's words are inside the other's but they differ" do
      expect(described_class.partial?("Student, Pat Q.", "Pat Student")).to be true
      expect(described_class.partial?("Pat", "Pat Student")).to be true
    end

    it "is false for an exact match, for unrelated names and for blanks" do
      expect(described_class.partial?("Pat Student", "student pat")).to be false
      expect(described_class.partial?("Pat Student", "Sam Student")).to be false
      expect(described_class.partial?("", "Pat")).to be false
    end
  end
end
