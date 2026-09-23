# frozen_string_literal: true

#
# Copyright (C) 2026 - present EXAMPLE contributors
#
# This file is part of EXAMPLE LMS, a modified version of Canvas.
#
# EXAMPLE LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

describe SelfPaced::ActivityLedger do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:context_module) { course.context_modules.create!(name: "Unit 1") }
  let_once(:page_tag) { context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson 1").id) }
  let_once(:other_tag) { context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson 2").id) }
  let(:at) { Time.zone.parse("2026-09-22 15:00:00 UTC") }

  def ping(seconds, content_tag: page_tag, time: at)
    described_class.record_ping(user: student, course:, seconds:, content_tag:, at: time)
  end

  def day_row
    SelfPaced::ActivityDay.find_by!(user: student, course:)
  end

  def state_row
    SelfPaced::StudentCourseState.find_by!(user: student, course:)
  end

  describe ".record_ping" do
    it "adds active seconds to the day and to the item" do
      ping(40)
      ping(20, time: at + 1.minute)

      expect([day_row.active_seconds, SelfPaced::ItemTime.find_by!(user: student, content_tag: page_tag).active_seconds])
        .to eql([60, 60])
    end

    it "records the first and last activity of the day and each item touched once" do
      ping(30)
      ping(30, content_tag: other_tag, time: at + 1.minute)
      ping(30, time: at + 2.minutes)

      expect(day_row).to have_attributes(first_activity_at: at,
                                         last_activity_at: at + 2.minutes,
                                         content_tag_ids: match_array([page_tag.id, other_tag.id]))
    end

    it "caps a single ping at #{described_class::MAX_SECONDS_PER_PING} seconds" do
      ping(10_000)

      expect(day_row.active_seconds).to be described_class::MAX_SECONDS_PER_PING
    end

    it "files activity under the day in the course's time zone" do
      course.update!(time_zone: "America/Chicago")
      ping(30, time: Time.zone.parse("2026-09-23 03:00:00 UTC")) # 22:00 on the 22nd in Chicago

      expect(day_row.day).to eql(Date.new(2026, 9, 22))
    end

    it "records presence but no activity for an idle ping" do
      ping(0)

      expect(SelfPaced::ActivityDay.where(user: student)).not_to exist
      expect(state_row).to have_attributes(last_seen_at: at, last_active_at: nil, viewing_content_tag_id: page_tag.id)
    end

    it "keeps the last active time when idle pings follow" do
      ping(30)
      ping(0, time: at + 1.minute)

      expect(state_row).to have_attributes(last_seen_at: at + 1.minute, last_active_at: at)
    end

    it "restarts viewing_since only when the student moves to another page" do
      ping(30)
      ping(30, time: at + 1.minute)
      expect(state_row.viewing_since).to eql(at)

      ping(30, content_tag: other_tag, time: at + 2.minutes)
      expect(state_row).to have_attributes(viewing_content_tag_id: other_tag.id, viewing_since: at + 2.minutes)
    end

    it "doesn't touch the progress columns" do
      SelfPaced::StudentCourseState.create!(user: student, course:, root_account: course.root_account, percent_complete: 50)
      ping(30)

      expect(state_row.percent_complete).to be 50.0
    end
  end

  describe ".record_submission" do
    it "counts submissions toward the day without adding active time" do
      2.times { described_class.record_submission(user: student, course:, at:) }

      expect(day_row).to have_attributes(submissions_count: 2, active_seconds: 0)
    end
  end
end
