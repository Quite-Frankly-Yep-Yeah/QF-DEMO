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
describe TeacherWorkflow::GradingQueue::Courses do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }

  before do
    course.root_account.enable_feature!(:teacher_workflow)
    course.account.enable_feature!(:workflow_grading_queue)
  end

  def entries(viewer, **opts)
    described_class.for(viewer, **opts)
  end

  it "returns the teacher's course with its students" do
    entry = entries(teacher).sole
    expect(entry.course).to eq course
    expect(entry.student_ids).to eq [student.id]
  end

  it "returns nothing for a student" do
    expect(entries(student)).to eq []
  end

  it "does not return a course where the teacher is only a student" do
    other = course_factory(active_all: true)
    student_in_course(course: other, user: teacher, active_all: true)
    other.account.enable_feature!(:workflow_grading_queue)

    expect(entries(teacher).map(&:course)).to eq [course]
  end

  it "returns nothing while the flag is off" do
    course.account.disable_feature!(:workflow_grading_queue)
    expect(entries(teacher)).to eq []
  end

  it "limits a section-limited TA to their own section" do
    other_section = course.course_sections.create!(name: "Other")
    other_student = student_in_course(course:, section: other_section, active_all: true).user
    ta = ta_in_course(course:, active_all: true).user
    Enrollment.where(user: ta, course:).update_all(limit_privileges_to_course_section: true,
                                                   course_section_id: course.default_section.id)

    expect(entries(ta).sole.student_ids).to eq [student.id]
    expect(entries(ta).sole.student_ids).not_to include(other_student.id)
  end

  it "narrows to one course with course_id" do
    expect(entries(teacher, course_id: course.id).map(&:course)).to eq [course]
    expect(entries(teacher, course_id: 0)).to eq []
  end
end
