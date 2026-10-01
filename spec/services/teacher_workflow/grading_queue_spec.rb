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
describe TeacherWorkflow::GradingQueue do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:ryan) { student_in_course(course:, active_all: true, name: "Ryan Cole").user }
  let_once(:mod) { course.context_modules.create!(name: "Unit 1") }
  let_once(:check) { course.assignments.create!(title: "Check 1", points_possible: 10, submission_types: "online_text_entry") }
  let_once(:check_tag) { mod.add_item(type: "assignment", id: check.id) }
  let(:now) { Time.zone.parse("2026-10-01 12:00:00 UTC") }

  before do
    course.root_account.enable_feature!(:teacher_workflow)
    course.account.enable_feature!(:workflow_grading_queue)
    check_tag
  end

  def submit(assignment, user, at:)
    assignment.submit_homework(user, submission_type: "online_text_entry", body: "work", submitted_at: at)
  end

  def queue(viewer = teacher, **)
    described_class.new(viewer, now:, **).result
  end

  def require_grade_on_check
    allow(SelfPaced::Gating).to receive_messages(player_course?: true, provisional?: false)
    mod.update!(completion_requirements: [{ id: check_tag.id, type: "min_percentage", min_percentage: 70 }])
  end

  def track(user, tag)
    SelfPaced::StudentCourseState.create!(course:, user:, root_account: course.root_account, current_content_tag: tag)
  end

  it "lists a waiting submission with the student, item and a SpeedGrader link" do
    submission = submit(check, maya, at: now - 2.days)
    row = queue[:rows].sole

    expect(row[:id]).to eq submission.id.to_s
    expect(row[:student]).to eq({ id: maya.id.to_s, name: "Maya Lopez" })
    expect(row[:item][:title]).to eq "Check 1"
    expect(row[:unit][:name]).to eq "Unit 1"
    expect(row[:speed_grader_url]).to eq "/courses/#{course.id}/gradebook/speed_grader?assignment_id=#{check.id}&student_id=#{maya.id}"
  end

  it "puts the oldest first within a tier" do
    newer = submit(check, maya, at: now - 1.day)
    older = submit(check, ryan, at: now - 3.days)
    expect(queue[:rows].pluck(:id)).to eq [older.id.to_s, newer.id.to_s]
  end

  it "ranks a blocked student above an older, unblocked one" do
    require_grade_on_check
    other = course.assignments.create!(title: "Other", points_possible: 5, submission_types: "online_text_entry")
    submit(other, ryan, at: now - 5.days)
    blocked = submit(check, maya, at: now - 1.day)
    track(maya, check_tag)

    rows = queue[:rows]
    expect(rows.first[:id]).to eq blocked.id.to_s
    expect(rows.first[:tier]).to eq 1
    expect(rows.first[:reason]).to match(/waiting on this to move on/)
  end

  it "filters to held-up work, one student, and one unit" do
    require_grade_on_check
    held = submit(check, maya, at: now - 1.day)
    submit(check, ryan, at: now - 2.days)
    track(maya, check_tag)

    expect(queue(held_up: true)[:rows].pluck(:id)).to eq [held.id.to_s]
    expect(queue(student_id: ryan.id)[:rows].size).to eq 1
    expect(queue(unit_id: mod.id)[:rows].size).to eq 2
    expect(queue(unit_id: 0)[:rows]).to be_empty
  end

  it "lists work that is in no module, and students with no tracked state" do
    loose = course.assignments.create!(title: "Loose", points_possible: 1, submission_types: "online_text_entry")
    submit(loose, maya, at: now - 1.day)
    row = queue[:rows].sole
    expect(row[:unit]).to be_nil
    expect(row[:tier]).to eq 4
  end

  it "is one row for a quiz attempt, and none once it is graded" do
    quiz = course.quizzes.create!(title: "Quiz", quiz_type: "assignment", points_possible: 5)
    quiz.quiz_questions.create!(question_data: { question_type: "essay_question", question_text: "Why?", points_possible: 5, name: "q" })
    quiz.generate_quiz_data
    quiz.publish!
    submission = quiz.generate_submission(maya)
    submission.update!(submission_data: { "question_#{quiz.quiz_questions.first.id}" => "because" })
    Quizzes::SubmissionGrader.new(submission).grade_submission

    expect(queue[:rows].count { |r| r[:item][:title] == "Quiz" }).to eq 1

    quiz.assignment.grade_student(maya, grade: 5, grader: teacher)
    expect(queue[:rows].count { |r| r[:item][:title] == "Quiz" }).to eq 0
  end

  it "hides the student on anonymous, unposted work" do
    anon = course.assignments.create!(title: "Anon",
                                      points_possible: 5,
                                      submission_types: "online_text_entry",
                                      anonymous_grading: true)
    anon.ensure_post_policy(post_manually: true)
    submission = submit(anon, maya, at: now - 1.day)
    row = queue[:rows].find { |r| r[:item][:title] == "Anon" }

    expect(row[:student]).to eq({ id: nil, name: "Anonymous student" })
    expect(row.to_json).not_to include("Maya")
    expect(row.to_json).not_to include(maya.id.to_s)
    expect(row[:speed_grader_url]).to include("anonymous_id=#{submission.anonymous_id}")
    expect(queue(student_id: maya.id)[:rows].map { |r| r[:item][:title] }).not_to include("Anon")
  end

  it "is empty for a student" do
    submit(check, maya, at: now - 1.day)
    expect(queue(maya)[:rows]).to eq []
  end

  it "keeps a section-limited TA to their section" do
    other_section = course.course_sections.create!(name: "Other")
    other = student_in_course(course:, section: other_section, active_all: true).user
    ta = ta_in_course(course:, active_all: true).user
    Enrollment.where(user: ta, course:).update_all(limit_privileges_to_course_section: true,
                                                   course_section_id: course.default_section.id)
    submit(check, maya, at: now - 1.day)
    submit(check, other, at: now - 2.days)
    expect(queue(ta)[:rows].map { |r| r[:student][:id] }).to eq [maya.id.to_s]
  end

  it "pages and reports truncation at the scan cap" do
    stub_const("#{described_class}::PER_PAGE", 1)
    stub_const("#{described_class}::SCAN_CAP", 1)
    submit(check, maya, at: now - 2.days)
    submit(check, ryan, at: now - 1.day)
    result = queue
    expect(result[:rows].size).to eq 1
    expect(result[:truncated]).to be true
  end

  it "does not run more queries as more submissions wait" do
    others = Array.new(5) { |i| student_in_course(course:, active_all: true, name: "S#{i}").user }

    # a run to fill the caches, then the counted one
    measure = lambda do
      queue
      count = 0
      counter = ->(*, payload) { count += 1 unless payload[:name] == "SCHEMA" }
      ActiveSupport::Notifications.subscribed(counter, "sql.active_record") { queue }
      count
    end

    submit(check, maya, at: now - 1.day)
    few = measure.call
    others.each_with_index { |user, i| submit(check, user, at: now - (i + 2).days) }
    expect(measure.call).to eq few
  end
end
