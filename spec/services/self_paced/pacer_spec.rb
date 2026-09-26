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

describe SelfPaced::Pacer do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:enrollment) { student_in_course(course:, active_all: true) }
  let_once(:student) { enrollment.user }
  let_once(:unit) { course.context_modules.create!(name: "Unit 1") }
  let_once(:pages) do
    Array.new(4) { |i| unit.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson #{i + 1}").id) }
  end

  # Monday; the course runs Monday to Friday, with four 30-minute lessons
  let(:mon) { Date.new(2026, 10, 5) }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.enable_feature!(:self_paced_pacing)
    course.enable_feature!(:self_paced_course_player)
    pages.each { |tag| SelfPaced::ItemSetting.create!(content_tag: tag, course:, role: "instruction", estimated_minutes: 30) }
    unit.update!(completion_requirements: pages.map { |tag| { id: tag.id, type: "must_view" } })
    enrollment.update!(start_at: course.time_zone.local(2026, 10, 5, 8))
    course.update!(self_paced_target_date: (mon + 4).iso8601)
  end

  def pacer(today: mon)
    described_class.new(Course.find(course.id), student, today:)
  end

  def view(*tags)
    tags.each { |tag| tag.context_module_action(student, :read) }
  end

  describe "#refresh!" do
    it "spreads the student's work over school days up to the target date" do
      plan = pacer.refresh!

      expect([plan.start_date, plan.target_date]).to eql([mon, mon + 4])
      expect(plan.planned_dates.values).to eql([mon + 1, mon + 2, mon + 3, mon + 4])
    end

    it "skips weekends and blackout dates" do
      course.update!(self_paced_target_date: (mon + 8).iso8601)
      course.blackout_dates.create!(event_title: "Break", start_date: mon + 2, end_date: mon + 2)

      expect(pacer.refresh!.planned_dates.values).to eql([mon + 1, mon + 3, mon + 7, mon + 8])
    end

    it "re-spreads the unfinished work once a day" do
      pacer.refresh!
      view(pages[0])

      expect(pacer.refresh!.planned_dates.keys).to include(pages[0].id)

      plan = pacer(today: mon + 1).refresh!
      expect(plan.planned_dates.keys).not_to include(pages[0].id)
      expect(plan.current["from"]).to eql((mon + 1).iso8601)
    end

    it "leaves the baseline alone when it re-spreads" do
      baseline = pacer.refresh!.baseline
      view(pages[0])

      expect(pacer(today: mon + 1).refresh!.baseline).to eql(baseline)
    end

    it "follows the course's target date when it moves" do
      pacer.refresh!
      course.update!(self_paced_target_date: (mon + 11).iso8601)

      plan = pacer(today: mon + 1).refresh!
      expect([plan.target_date, plan.version]).to eql([mon + 11, 2])
    end

    it "plans everything on the next school day once the target date has passed" do
      pacer.refresh!

      expect(pacer(today: mon + 7).refresh!.planned_dates.values.uniq).to eql([mon + 7])
    end

    it "drops exempt items and counts completed ones" do
      SelfPaced::ItemOverride.create!(content_tag: pages[3], user: student, kind: "exempt")
      SelfPaced::ItemOverride.create!(content_tag: pages[0], user: student, kind: "complete")
      RequestCache.clear
      paced = pacer
      paced.refresh!

      expect(paced.plan.planned_dates.keys).to eql([pages[1].id, pages[2].id])
      expect(paced.status[:percent_complete]).to eql(33.3)
    end

    it "writes the due dates in the background" do
      expect { pacer.refresh! }.to change { Delayed::Job.where(tag: "SelfPaced::DueDateWriter.write_by_ids").count }.by(1)
    end

    it "does nothing for people who aren't students" do
      expect(described_class.new(course, teacher, today: mon).refresh!).to be_nil
    end
  end

  describe "#status" do
    it "counts days behind against the baseline" do
      pacer.refresh!

      expect(pacer(today: mon + 3).status).to include(days_ahead: -3, expected_percent: 60.0, percent_complete: 0.0)
    end

    it "counts days ahead" do
      pacer.refresh!
      view(*pages.first(3))

      expect(pacer.status).to include(days_ahead: 3, percent_complete: 75.0)
    end

    it "keeps counting school days after the target date" do
      pacer.refresh!

      expect(pacer(today: mon + 8).status[:days_ahead]).to be(-6)
    end

    it "never shows a finished student as behind" do
      pacer.refresh!
      view(*pages)

      expect(pacer(today: mon + 14).status).to include(days_ahead: 0, finished: true)
    end

    it "lists today's and this week's goals from the current plan" do
      pacer.refresh!
      view(pages[0])

      expect(pacer(today: mon + 1).status).to include(today: include(total: 1, done: 1, minutes: 30),
                                                      week: include(total: 4, done: 1, minutes: 120))
    end
  end

  describe "target dates" do
    it "keeps a teacher's date until it's reset" do
      pacer.set_target!(mon + 9, actor: teacher)
      course.update!(self_paced_target_date: (mon + 2).iso8601)

      plan = pacer(today: mon + 1).refresh!
      expect([plan.target_date, plan.target_source, plan.target_set_by]).to eql([mon + 9, "teacher", teacher])

      plan = pacer.reset_target!(actor: teacher)
      expect([plan.target_date, plan.target_source]).to eql([mon + 2, "default"])
    end

    it "falls back to the course's end date" do
      course.update!(self_paced_target_date: nil, conclude_at: course.time_zone.local(2026, 10, 16, 23, 59))

      expect(pacer.refresh!.target_date).to eql(mon + 11)
    end
  end

  describe "#state_attributes" do
    it "gives the read model's pacing columns and records the day's progress" do
      pacer.refresh!
      view(pages[0])

      paced = pacer(today: mon + 2)
      expect(paced.state_attributes).to eql(days_behind: 1, target_date: mon + 4, expected_percent: 40.0)
      expect(paced.plan.reload.history).to eql((mon + 2).iso8601 => 25.0)
    end
  end

  describe "#as_json" do
    it "lists the week's items with their dates, and the chart" do
      pacer.refresh!
      json = pacer.as_json(can_adjust: true)

      expect(json[:items].map { |item| [item[:title], item[:planned_date]] }).to eql(
        [["Lesson 1", "2026-10-06"], ["Lesson 2", "2026-10-07"], ["Lesson 3", "2026-10-08"], ["Lesson 4", "2026-10-09"]]
      )
      expect(json[:chart][:baseline].last).to eql(["2026-10-09", 100.0])
      expect(json).to include(target_date: "2026-10-09", can_adjust: true)
    end
  end
end
