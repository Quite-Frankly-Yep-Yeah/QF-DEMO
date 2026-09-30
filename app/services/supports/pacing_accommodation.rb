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

# An extended-deadlines accommodation on a student's pacing plan
# (docs/teacher-workflow-plan.md §2.3, Q8). The case manager picks the mode:
#
# - extend_finish: the default finish date moves out by +percent+ of the
#   student's school days. A date a teacher set by hand still wins.
# - lower_daily: the finish date stays, and the daily target drops by
#   +percent+. The work is spread past the finish date, so the student is
#   measured against the lower pace and shows a projected finish after it.
#
# SelfPaced::Pacer asks for this and stays the only thing that plans;
# SelfPaced::DueDateWriter stays the only writer of due dates.
module Supports
  class PacingAccommodation
    MAX_LOWER_DAILY_PERCENT = 90

    attr_reader :accommodation, :mode, :percent

    # The largest pacing accommodation +student+ has in +course+, or nil.
    def self.for(student, course)
      rows = Applier.current(student, course, "extended_deadlines")
      best = rows.max_by { |row| [row.parameters["percent"].to_i, row.id] }
      best && new(best)
    end

    def initialize(accommodation)
      @accommodation = accommodation
      @mode = (accommodation.parameters["mode"] == "lower_daily") ? "lower_daily" : "extend_finish"
      percent = accommodation.parameters["percent"].to_i
      @percent = (@mode == "lower_daily") ? percent.clamp(0, MAX_LOWER_DAILY_PERCENT) : percent.clamp(0, 200)
    end

    def extend_finish?
      mode == "extend_finish"
    end

    def lower_daily?
      mode == "lower_daily"
    end

    # Stored on the plan's baseline, so a change rebuilds it.
    def key
      "#{accommodation.id}:#{mode}:#{percent}"
    end

    # The school days to add after +to+ for a plan that runs from +from+.
    def extra_days(calendar, from, to)
      days = calendar.instructional_days(from, to).size
      return 0 if days.zero? || percent.zero?

      share = lower_daily? ? percent / (100.0 - percent) : percent / 100.0
      (days * share).ceil
    end

    # +to+ moved out by the extra school days.
    def extend(calendar, from, to)
      date = to
      extra_days(calendar, from, to).times { date = calendar.next_instructional_day(date + 1) }
      date
    end
  end
end
