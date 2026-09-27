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

describe Supports::AccommodationType do
  describe ".parameter_errors" do
    it "accepts a multiplier or minutes for extended time" do
      expect(described_class.parameter_errors("extended_time", { multiplier: 1.5 })).to be_empty
      expect(described_class.parameter_errors("extended_time", { minutes: 30 })).to be_empty
    end

    it "rejects extended time that would shorten or not change the time" do
      expect(described_class.parameter_errors("extended_time", { multiplier: 1 })).not_to be_empty
      expect(described_class.parameter_errors("extended_time", {})).not_to be_empty
    end

    it "needs a mode and a percentage for pacing" do
      expect(described_class.parameter_errors("extended_deadlines", { percent: 25, mode: "lower_daily" })).to be_empty
      expect(described_class.parameter_errors("extended_deadlines", { percent: 25 })).not_to be_empty
    end

    it "only allows the display settings the app has" do
      expect(described_class.parameter_errors("display", { setting: "use_dyslexic_font" })).to be_empty
      expect(described_class.parameter_errors("display", { setting: "reduced_motion" })).not_to be_empty
    end
  end

  describe ".parameters_text" do
    it "describes extended time in plain words" do
      expect(described_class.parameters_text("extended_time", { "multiplier" => 1.5 })).to eql "1.5x time on timed quizzes"
      expect(described_class.parameters_text("extended_time", { "minutes" => 30 })).to eql "30 extra minutes on timed quizzes"
    end

    it "describes both pacing modes" do
      expect(described_class.parameters_text("extended_deadlines", { "percent" => 25, "mode" => "extend_finish" }))
        .to eql "Finish date moved out by 25%"
      expect(described_class.parameters_text("extended_deadlines", { "percent" => 25, "mode" => "lower_daily" }))
        .to eql "Daily work target lowered by 25%"
    end
  end

  it "won't save a catalog item with invalid default parameters" do
    type = described_class.new(root_account: Account.default, name: "Time", kind: "extended_time",
                               default_parameters: { multiplier: 9 })
    expect(type).not_to be_valid
  end
end
