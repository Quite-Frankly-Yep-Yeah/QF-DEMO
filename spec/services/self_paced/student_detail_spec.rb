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

describe SelfPaced::StudentDetail do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:context_module) { course.context_modules.create!(name: "Unit 1") }
  let_once(:page_tag) { context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson 1").id) }
  let_once(:assignment) { course.assignments.create!(title: "Check 1", submission_types: "online_text_entry", points_possible: 10) }
  let_once(:assignment_tag) { context_module.add_item(type: "assignment", id: assignment.id) }
  let(:now) { Time.zone.now }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.account.enable_feature!(:self_paced_activity_tracking)
    course.account.enable_feature!(:self_paced_teacher_dashboard)
    context_module.update!(completion_requirements: [{ id: page_tag.id, type: "must_view" },
                                                     { id: assignment_tag.id, type: "must_submit" }])
  end

  def detail(viewer = teacher)
    described_class.new(SelfPaced::DashboardScope.new(viewer), course, student, now:).as_json
  end

  it "has one activity entry per day for the last four weeks, zeros included" do
    SelfPaced::ActivityLedger.record_ping(user: student, course:, seconds: 60, content_tag: page_tag, at: now)
    activity = detail[:activity]

    expect([activity.size, activity.last[:active_seconds], activity.first[:active_seconds]]).to eql([28, 60, 0])
  end

  it "lists every module item in order with time spent and completion" do
    SelfPaced::ActivityLedger.record_ping(user: student, course:, seconds: 45, content_tag: page_tag, at: now)
    page_tag.context_module_action(student, :read)

    expect(detail[:items].map { |i| i.slice(:title, :active_seconds, :completed) }).to eql([
                                                                                             { title: "Lesson 1", active_seconds: 45, completed: true },
                                                                                             { title: "Check 1", active_seconds: 0, completed: false }
                                                                                           ])
  end

  it "shows every attempt with its score" do
    assignment.submit_homework(student, body: "first")
    assignment.grade_student(student, grade: 4, grader: teacher)
    assignment.submit_homework(student, body: "second")
    attempts = detail[:attempts].first[:attempts]

    expect(attempts.pluck(:attempt)).to eql([1, 2])
    expect(attempts.first[:score]).to be 4.0
  end

  it "puts recent submissions and item views on the timeline, newest first" do
    SelfPaced::ActivityLedger.record_ping(user: student, course:, seconds: 45, content_tag: page_tag, at: 1.hour.ago)
    assignment.submit_homework(student, body: "done")

    expect(detail[:timeline].pluck(:kind)).to eql(%w[submitted viewed])
  end
end
