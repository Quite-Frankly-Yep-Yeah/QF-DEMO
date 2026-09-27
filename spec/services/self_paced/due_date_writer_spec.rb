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

describe SelfPaced::DueDateWriter do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:classmate) { student_in_course(course:, active_all: true).user }
  let_once(:unit) { course.context_modules.create!(name: "Unit 1") }
  let_once(:assignments) do
    Array.new(3) { |i| course.assignments.create!(title: "Check #{i + 1}", submission_types: "online_text_entry", points_possible: 10) }
  end
  let_once(:tags) { assignments.map { |assignment| unit.add_item(type: "assignment", id: assignment.id) } }

  let(:mon) { Date.new(2026, 10, 5) }
  let(:monday_morning) { course.time_zone.local(2026, 10, 5, 9) }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.enable_feature!(:self_paced_pacing)
  end

  def plan(dates, user = student)
    SelfPaced::PacingPlan.find_or_initialize_by(course:, user:).tap do |plan|
      plan.update!(start_date: mon,
                   target_date: mon + 60,
                   current: { "items" => tags.zip(dates).map { |tag, date| [tag.id, date.iso8601, 30] } })
    end
  end

  def write(user = student, at: monday_morning)
    described_class.new(Course.find(course.id), user, now: at).write!
  end

  def due_at(assignment, user = student)
    Assignment.find(assignment.id).overridden_for(user).due_at
  end

  def end_of(date)
    CanvasTime.fancy_midnight(course.time_zone.local(date.year, date.month, date.day))
  end

  describe "#write!" do
    it "gives the student the plan's dates as their own due dates" do
      plan([mon, mon + 1, mon + 2])

      expect(write).to match_array(assignments)
      expect(assignments.map { |assignment| due_at(assignment) }).to eq([end_of(mon), end_of(mon + 1), end_of(mon + 2)])
      expect(due_at(assignments[0], classmate)).to be_nil
    end

    it "shares one override between students due the same day" do
      plan([mon, mon + 1, mon + 2])
      plan([mon, mon + 1, mon + 2], classmate)
      write
      write(classmate)

      expect(assignments[0].assignment_overrides.active.count).to be(1)
      expect(due_at(assignments[0], classmate)).to eq(end_of(mon))
    end

    it "only writes dates that moved" do
      plan([mon, mon + 1, mon + 2])
      write
      expect(write).to be_empty

      plan([mon, mon + 1, mon + 3])
      expect(write).to eql([assignments[2]])
      expect(due_at(assignments[2])).to eq(end_of(mon + 3))
    end

    it "leaves submitted items alone" do
      assignments[0].submit_homework(student, body: "done")
      plan([mon, mon + 1, mon + 2])

      expect(write).to match_array(assignments.drop(1))
    end

    it "leaves a date that has passed" do
      plan([mon, mon + 1, mon + 2])
      write
      plan([mon + 3, mon + 3, mon + 3])
      write(at: monday_morning + 2.days)

      expect(due_at(assignments[0])).to eq(end_of(mon))
      expect(due_at(assignments[2])).to eq(end_of(mon + 3))
    end

    it "leaves a teacher's own override alone" do
      teacher_date = end_of(mon + 20)
      override = assignments[0].assignment_overrides.create!(set_type: "ADHOC", due_at: teacher_date, due_at_overridden: true)
      override.assignment_override_students.create!(user: student)
      plan([mon, mon + 1, mon + 2])

      expect(write).not_to include(assignments[0])
      expect(due_at(assignments[0])).to eq(teacher_date)
    end

    it "leaves a date after a teacher changed it" do
      plan([mon + 1, mon + 1, mon + 2])
      write
      teacher_date = end_of(mon + 9)
      assignments[0].assignment_overrides.active.find_by(title: described_class::OVERRIDE_TITLE).update!(due_at: teacher_date)
      plan([mon + 2, mon + 2, mon + 2])

      expect(write).not_to include(assignments[0])
      expect(due_at(assignments[0])).to eq(teacher_date)
    end

    it "leaves items with a section due date alone" do
      section_date = end_of(mon + 20)
      assignments[1].assignment_overrides.create!(set: course.default_section, due_at: section_date, due_at_overridden: true)
      plan([mon, mon + 1, mon + 2])

      expect(write).not_to include(assignments[1])
      expect(due_at(assignments[1])).to eq(section_date)
    end

    it "only dates the next two school weeks" do
      plan([mon, mon + 14, mon + 11])

      expect(write).to match_array([assignments[0], assignments[2]])
      expect(due_at(assignments[1])).to be_nil
    end

    it "keeps moving a date it already wrote, even out of the window" do
      plan([mon, mon + 1, mon + 2])
      write
      plan([mon, mon + 1, mon + 30])

      expect(write).to eql([assignments[2]])
      expect(due_at(assignments[2])).to eq(end_of(mon + 30))
    end

    it "does nothing while pacing is off" do
      plan([mon, mon + 1, mon + 2])
      course.disable_feature!(:self_paced_pacing)

      expect(write).to be_empty
    end
  end
end
