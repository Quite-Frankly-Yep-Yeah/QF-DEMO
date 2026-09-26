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

describe SelfPaced::PlanBuilder do
  let(:mon) { Date.new(2026, 10, 5) }

  def days(*minutes)
    minutes.each_with_index.map { |day_minutes, i| [mon + i, day_minutes] }
  end

  describe ".spread" do
    it "spreads the work evenly over full days" do
      result = described_class.spread([[1, 30], [2, 30], [3, 30], [4, 30]], days(360, 360))

      expect(result[:items]).to eql([[1, mon, 30], [2, mon, 30], [3, mon + 1, 30], [4, mon + 1, 30]])
      expect(result[:days]).to eql([[mon, 60.0], [mon + 1, 120.0]])
      expect(result[:daily_minutes]).to be(60)
    end

    it "gives a half day half as much work" do
      result = described_class.spread([[1, 30], [2, 30], [3, 30]], days(360, 180))

      expect(result[:items].map { |_, date, _| date }).to eql([mon, mon, mon + 1])
      expect(result[:days]).to eql([[mon, 60.0], [mon + 1, 90.0]])
    end

    it "plans an item on the day its work is finished" do
      result = described_class.spread([[1, 90]], days(360, 360))

      expect(result[:items]).to eql([[1, mon + 1, 90]])
    end

    it "puts everything on the one day left" do
      result = described_class.spread([[1, 30], [2, 30]], [[mon, 1]])

      expect(result[:items].map { |_, date, _| date }).to eql([mon, mon])
    end

    it "copes with items that take no time" do
      result = described_class.spread([[1, 0], [2, 0]], days(360, 360))

      expect(result[:items].map { |_, date, _| date }).to eql([mon, mon])
      expect(result[:days]).to eql([[mon, 0.0], [mon + 1, 0.0]])
    end

    it "needs at least one day" do
      expect { described_class.spread([[1, 30]], []) }.to raise_error(ArgumentError)
    end
  end
end
