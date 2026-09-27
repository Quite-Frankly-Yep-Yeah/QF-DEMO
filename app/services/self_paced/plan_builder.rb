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

# Spreads a list of items over school days (docs/fork-plan.md §2.3). Each day
# gets a share of the work in proportion to its instructional minutes, so a
# half day gets half as much. An item is planned on the day the running total
# of work reaches the end of it.
#
#   PlanBuilder.spread([[tag_id, minutes], ...], [[date, day_minutes], ...])
#   # => { items: [[tag_id, date, minutes], ...],
#   #      days: [[date, work minutes planned by the end of that day], ...],
#   #      daily_minutes: minutes of work on a full day }
module SelfPaced
  module PlanBuilder
    # Rounding slack so an item that ends exactly on a day boundary lands on
    # that day, not the next.
    EPSILON = 0.01

    def self.spread(items, days)
      raise ArgumentError, "at least one day is needed" if days.empty?

      total = items.sum { |_, minutes| minutes.to_f }
      weight = days.sum { |_, day_minutes| day_minutes.to_f }
      rate = weight.positive? ? total / weight : 0.0

      running = 0.0
      planned_days = days.map do |date, day_minutes|
        running += day_minutes * rate
        [date, running]
      end
      planned_days[-1][1] = total # absorb floating-point drift

      index = 0
      done = 0.0
      planned_items = items.map do |id, minutes|
        done += minutes.to_f
        index += 1 while index < planned_days.size - 1 && planned_days[index][1] < done - EPSILON
        [id, planned_days[index][0], minutes]
      end

      {
        items: planned_items,
        days: planned_days.map { |date, minutes| [date, minutes.round(1)] },
        daily_minutes: (days.map(&:last).max.to_f * rate).round
      }
    end
  end
end
