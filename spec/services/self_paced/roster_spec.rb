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

describe SelfPaced::Roster do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:tag) do
    course.context_modules.create!(name: "Unit 1").add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson 1").id)
  end
  let(:now) { Time.zone.parse("2026-09-22 15:00:00 UTC") }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.account.enable_feature!(:self_paced_activity_tracking)
    course.account.enable_feature!(:self_paced_teacher_dashboard)
  end

  def rows(viewer = teacher, idle_minutes: 5)
    described_class.new(SelfPaced::DashboardScope.new(viewer), idle_minutes:, now:).rows
  end

  def ping(seconds, at)
    SelfPaced::ActivityLedger.record_ping(user: student, course:, seconds:, content_tag: tag, at:)
  end

  describe "#rows" do
    it "shows a student who is active right now as working, on the item they're viewing" do
      ping(30, now - 30.seconds)

      expect(rows.first).to include(status: "working", viewing: { id: tag.id.to_s, title: "Lesson 1", type: "WikiPage" })
    end

    it "shows a student with an open but untouched tab as idle" do
      ping(30, now - 10.minutes)
      ping(0, now - 30.seconds)

      expect(rows.first[:status]).to eql("idle")
    end

    it "uses the viewer's idle threshold" do
      ping(30, now - 10.minutes)
      ping(0, now - 30.seconds)

      expect(rows(idle_minutes: 15).first[:status]).to eql("working")
    end

    it "shows a student who hasn't pinged for a few minutes as away" do
      ping(30, now - 5.minutes)

      expect(rows.first[:status]).to eql("away")
    end

    it "adds up active time for today and for the week so far" do
      ping(60, now - 1.hour)
      ping(90, now - 1.day) # Monday; the 22nd is a Tuesday
      ping(45, now - 3.days) # last week

      expect(rows.first).to include(seconds_today: 60, seconds_this_week: 150)
    end

    it "shows teachers the unposted score" do
      SelfPaced::StudentCourseState.create!(course:,
                                            user: student,
                                            root_account: course.root_account,
                                            current_score: 70.0,
                                            unposted_current_score: 90.0)

      expect(rows.first[:score]).to be 90.0
    end

    it "marks students the viewer has pinned" do
      ping(30, now)
      SelfPaced::MentorCaseload.create!(mentor: teacher, student:, root_account: course.root_account)

      expect(rows.first[:pinned]).to be true
    end

    it "is empty for someone who can't see the dashboard" do
      ping(30, now)

      expect(rows(student)).to be_empty
    end
  end
end
