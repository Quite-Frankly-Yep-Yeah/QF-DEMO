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
describe TeacherWorkflow::GradingTurnaround do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:other_teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:assignment) { course.assignments.create!(title: "A", points_possible: 10, submission_types: "online_text_entry") }
  let(:now) { Time.zone.parse("2026-10-01 12:00:00 UTC") }

  def graded(student, submitted:, graded_at:, grader:)
    assignment.submit_homework(student, submission_type: "online_text_entry", body: "x", submitted_at: submitted)
    Submission.where(assignment:, user: student).update_all(graded_at:, grader_id: grader.id, score: 5, workflow_state: "graded")
  end

  def student
    student_in_course(course:, active_all: true).user
  end

  it "is the viewer's median hours from submitted to graded" do
    graded(student, submitted: now - 30.hours, graded_at: now - 24.hours, grader: teacher)
    graded(student, submitted: now - 30.hours, graded_at: now - 6.hours, grader: teacher)
    graded(student, submitted: now - 30.hours, graded_at: now - 1.hour, grader: other_teacher)

    result = described_class.for(teacher, [course.id], now:)
    expect(result[course.id][:graded_count]).to eq 2
    expect(result[course.id][:median_hours]).to be_within(0.01).of(15.0)
  end

  it "ignores grading older than 30 days and has no entry when there is none" do
    graded(student, submitted: now - 60.days, graded_at: now - 59.days, grader: teacher)
    expect(described_class.for(teacher, [course.id], now:)).to eq({})
  end
end
