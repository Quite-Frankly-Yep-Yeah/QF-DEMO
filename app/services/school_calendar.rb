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

# Which days a course is taught on, and for how long (docs/fork-plan.md §2.3).
#
# Blackout days come from the course's and its accounts' blackout dates and
# from calendar events flagged as blackout dates. Course Pacing and self-paced
# pacing both read them from here. The weekly pattern and half days come from
# the nearest InstructionalCalendar up the account chain; Course Pacing keeps
# its own weekday settings.
class SchoolCalendar
  DEFAULT_WEEKDAY_MINUTES = [0, 360, 360, 360, 360, 360, 0].freeze

  # How far to look for the next school day before giving up.
  SEARCH_LIMIT = 366

  attr_reader :course

  def initialize(course, calendar: :lookup)
    @course = course
    @calendar = (calendar == :lookup) ? InstructionalCalendar.for_account(course.account) : calendar
  end

  # BlackoutDate and CalendarEvent records that apply to the course. Reads the
  # course's blackout_dates association as loaded, so unsaved dates built on it
  # (Course Pacing previews) count too.
  def blackout_records
    @blackout_records ||= course.blackout_dates.to_a + account_blackout_dates + calendar_event_blackout_dates
  end

  def blackout_dates
    @blackout_dates ||= blackout_records.each_with_object(Set.new) do |record, dates|
      range = if record.is_a?(CalendarEvent)
                record.start_at.in_time_zone(time_zone).to_date..record.end_at.in_time_zone(time_zone).to_date
              else
                record.start_date..record.end_date
              end
      dates.merge(range.to_a)
    end
  end

  def weekday_minutes
    @calendar&.weekday_minutes.presence || DEFAULT_WEEKDAY_MINUTES
  end

  def minutes_on(date)
    return 0 if blackout_dates.include?(date)

    special = @calendar&.date_minutes&.[](date.iso8601)
    (special || weekday_minutes[date.wday]).to_i
  end

  def instructional?(date)
    minutes_on(date).positive?
  end

  # [[date, minutes], ...] for every school day from +from+ to +to+, inclusive.
  def instructional_days(from, to)
    return [] if from.nil? || to.nil? || to < from

    (from..to).filter_map do |date|
      minutes = minutes_on(date)
      [date, minutes] if minutes.positive?
    end
  end

  # School days on or after +from+ and before +to+.
  def count_between(from, to)
    return 0 if to <= from

    (from...to).count { |date| instructional?(date) }
  end

  # The first school day on or after +date+, or +date+ itself if there isn't
  # one within a year (an empty calendar shouldn't break planning).
  def next_instructional_day(date)
    (date..(date + SEARCH_LIMIT)).find { |day| instructional?(day) } || date
  end

  delegate :time_zone, to: :course

  delegate :today, to: :time_zone

  private

  def account_chain_ids
    @account_chain_ids ||= Account.multi_account_chain_ids([course.account_id])
  end

  def account_blackout_dates
    BlackoutDate.where(context_type: "Account", context_id: account_chain_ids).to_a
  end

  def calendar_event_blackout_dates
    context_codes = account_chain_ids.map { |id| "account_#{id}" } << "course_#{course.id}"
    CalendarEvent.with_blackout_date.active.valid_ranges.for_context_codes(context_codes).to_a
  end
end
