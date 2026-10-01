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
describe TeacherWorkflow::BacklogEvaluator do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:admin) { account_admin_user(account: course.account) }
  let_once(:assignment) { course.assignments.create!(title: "A", points_possible: 10, submission_types: "online_text_entry") }
  let(:now) { Time.zone.parse("2026-10-14 15:00:00 UTC") } # a Wednesday

  before do
    course.root_account.enable_feature!(:self_paced)
    course.root_account.enable_feature!(:teacher_workflow)
    course.account.enable_feature!(:workflow_grading_queue)
    notification = Notification.find_or_create_by!(name: described_class::NOTIFICATION_NAME, category: "Grading")
    # both could be told; only the admin should be
    [admin, teacher].each do |user|
      user.communication_channels.create!(path: "user#{user.id}@example.com").confirm!
      NotificationPolicy.find_or_create_by!(communication_channel: user.communication_channel, notification:, frequency: "immediately")
    end
  end

  def wait(since)
    assignment.submit_homework(student, submission_type: "online_text_entry", body: "x", submitted_at: since)
  end

  def run
    described_class.evaluate_all(now:)
  end

  def message_count(user)
    Message.where(user:, notification_name: described_class::NOTIFICATION_NAME).count
  end

  it "opens nothing when nothing is waiting" do
    run
    expect(TeacherWorkflow::BacklogAlert.count).to eq 0
  end

  it "opens nothing while the oldest item is within the limit" do
    wait(Time.zone.parse("2026-10-12 10:00:00 UTC")) # Monday: 2 school days
    run
    expect(TeacherWorkflow::BacklogAlert.count).to eq 0
  end

  it "opens one alert and tells the admins, once, when the limit is passed" do
    wait(Time.zone.parse("2026-10-05 10:00:00 UTC")) # a week earlier
    expect { run }.to change { TeacherWorkflow::BacklogAlert.currently_open.count }.from(0).to(1)
    expect { run }.not_to change { TeacherWorkflow::BacklogAlert.count }

    alert = TeacherWorkflow::BacklogAlert.currently_open.sole
    expect(alert.school_days_waiting).to be >= 5
    expect(alert.notified_at).to be_present
    expect(message_count(admin)).to eq 1
    expect(message_count(teacher)).to eq 0
  end

  it "resolves the alert, once, when the backlog clears" do
    wait(Time.zone.parse("2026-10-05 10:00:00 UTC"))
    run
    Submission.where(user: student).update_all(score: 5, workflow_state: "graded", grade_matches_current_submission: true)
    run
    expect(TeacherWorkflow::BacklogAlert.currently_open).to be_empty
    expect(TeacherWorkflow::BacklogAlert.where(workflow_state: "resolved").count).to eq 1
    run
    expect(TeacherWorkflow::BacklogAlert.where(workflow_state: "resolved").count).to eq 1
  end

  it "leaves courses without the flag alone" do
    course.account.disable_feature!(:workflow_grading_queue)
    wait(Time.zone.parse("2026-10-05 10:00:00 UTC"))
    run
    expect(TeacherWorkflow::BacklogAlert.count).to eq 0
  end

  it "uses the school's own limit" do
    course.account.settings[:grading_backlog_days] = { value: 2 }
    course.account.save!
    wait(Time.zone.parse("2026-10-12 10:00:00 UTC"))
    run
    expect(TeacherWorkflow::BacklogAlert.currently_open.count).to eq 1
  end

  it "ignores Student View submissions" do
    test_student = course.student_view_student
    assignment.submit_homework(test_student,
                               submission_type: "online_text_entry",
                               body: "x",
                               submitted_at: Time.zone.parse("2026-10-05 10:00:00 UTC"))
    run
    expect(TeacherWorkflow::BacklogAlert.count).to eq 0
  end

  it "ignores a course whose term has ended and resolves the alert it had" do
    wait(Time.zone.parse("2026-10-05 10:00:00 UTC"))
    run
    expect(TeacherWorkflow::BacklogAlert.currently_open.count).to eq 1

    # the term ended, but the enrollments are still active
    course.update!(conclude_at: 1.day.ago, restrict_enrollments_to_course_dates: true)
    run
    expect(TeacherWorkflow::BacklogAlert.currently_open).to be_empty
    expect(TeacherWorkflow::BacklogAlert.where(workflow_state: "resolved").count).to eq 1
  end

  it "survives a waiting submission with no submitted_at" do
    wait(Time.zone.parse("2026-10-05 10:00:00 UTC"))
    Submission.where(user: student).update_all(submitted_at: nil)
    expect { run }.not_to raise_error
    expect(TeacherWorkflow::BacklogAlert.count).to eq 0
  end
end
