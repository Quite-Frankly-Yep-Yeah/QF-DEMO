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

describe SchoolCalendar do
  let_once(:school) { Account.default.sub_accounts.create!(name: "School") }
  let_once(:course) { course_factory(account: school, active_all: true) }
  let(:mon) { Date.new(2026, 10, 5) }
  let(:calendar) { described_class.new(Course.find(course.id)) }

  describe "#minutes_on" do
    it "teaches weekdays by default" do
      expect((mon..(mon + 6)).map { |date| calendar.minutes_on(date) }).to eql([360, 360, 360, 360, 360, 0, 0])
    end

    it "uses the nearest calendar up the account chain" do
      InstructionalCalendar.create!(account: Account.default, weekday_minutes: [0, 300, 300, 300, 300, 120, 0])
      expect(calendar.minutes_on(mon + 4)).to be(120)

      InstructionalCalendar.create!(account: school, weekday_minutes: [0, 200, 200, 200, 200, 200, 0])
      expect(described_class.new(Course.find(course.id)).minutes_on(mon + 4)).to be(200)
    end

    it "honours shorter days on specific dates" do
      InstructionalCalendar.create!(account: school, date_minutes: { mon.iso8601 => 180 })

      expect(calendar.minutes_on(mon)).to be(180)
      expect(calendar.minutes_on(mon + 1)).to be(360)
    end

    it "skips the course's and its accounts' blackout dates" do
      course.blackout_dates.create!(event_title: "Break", start_date: mon, end_date: mon + 1)
      Account.default.blackout_dates.create!(event_title: "District day", start_date: mon + 2, end_date: mon + 2)

      expect((mon..(mon + 3)).map { |date| calendar.minutes_on(date) }).to eql([0, 0, 0, 360])
    end

    it "skips calendar events marked as blackout dates" do
      noon = course.time_zone.local(2026, 10, 8, 12)
      course.calendar_events.create!(title: "Holiday", start_at: noon, end_at: noon + 1.hour, blackout_date: true)

      expect(calendar.minutes_on(mon + 3)).to be(0)
    end
  end

  describe "#instructional_days" do
    it "lists school days with their minutes" do
      expect(calendar.instructional_days(mon + 4, mon + 7)).to eql([[mon + 4, 360], [mon + 7, 360]])
    end
  end

  describe "#count_between" do
    it "counts school days from the first date up to the second" do
      expect(calendar.count_between(mon, mon + 7)).to be(5)
      expect(calendar.count_between(mon, mon)).to be(0)
    end
  end

  describe "#next_instructional_day" do
    it "finds the next school day" do
      expect(calendar.next_instructional_day(mon + 5)).to eql(mon + 7)
    end

    it "gives up on a calendar with no school days" do
      InstructionalCalendar.create!(account: school, weekday_minutes: [0, 0, 0, 0, 0, 0, 0])

      expect(calendar.next_instructional_day(mon)).to eql(mon)
    end
  end

  describe "#blackout_records" do
    it "includes unsaved dates built on the course, for Course Pacing previews" do
      unsaved = course.blackout_dates.build(event_title: "Preview", start_date: mon, end_date: mon)

      expect(described_class.new(course).blackout_records).to include(unsaved)
    end
  end
end
