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

describe Supports::QuizAccommodations do
  let_once(:root_account) { Account.default }
  let_once(:course) { course_factory(active_all: true) }
  let_once(:other_course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Pat Student").user }
  let_once(:classmate) { student_in_course(course:, active_all: true, name: "Sam Classmate").user }
  let_once(:plan) { Supports::Plan.create!(account: root_account, student:, plan_type: "504") }
  let(:extended_time_type) { Supports::AccommodationType.find_by(root_account:, kind: "extended_time") }
  let(:extra_attempts_type) { Supports::AccommodationType.find_by(root_account:, kind: "extra_attempts") }

  let(:quiz) { make_quiz(time_limit: 30) }

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
    root_account.enable_feature!(:supports_accommodations_apply)
    Supports::Catalog.ensure_defaults!(root_account)
  end

  def make_quiz(time_limit: nil, allowed_attempts: 1, lock_at: nil)
    quiz = course.quizzes.create!(title: "Quiz", time_limit:, allowed_attempts:, lock_at:)
    quiz.quiz_questions.create!(question_data: { question_type: "essay_question", question_text: "Why?", points_possible: 1 })
    quiz.generate_quiz_data
    quiz.workflow_state = "available"
    quiz.save!
    quiz
  end

  def accommodate(type = extended_time_type, **parameters)
    plan.accommodations.create!(accommodation_type: type, parameters:)
  end

  def finish(submission)
    submission.mark_completed
    Quizzes::SubmissionGrader.new(submission).grade_submission
    submission.reload
  end

  describe "extended time when an attempt starts" do
    it "gives a multiplier's extra minutes on the first attempt" do
      accommodate(multiplier: 1.5)
      submission = quiz.generate_submission(student)

      expect(submission.extra_time).to be 15
      expect(submission.end_at).to be_within(1.second).of(submission.started_at + 45.minutes)
    end

    it "gives fixed minutes" do
      accommodate(minutes: 20)

      expect(quiz.generate_submission(student).extra_time).to be 20
    end

    it "keeps the extra time on a retake and records each attempt" do
      accommodate(minutes: 20)
      quiz.update!(allowed_attempts: 2)
      first = finish(quiz.generate_submission(student))
      second = quiz.generate_submission(student)

      expect([second.id, second.attempt, second.extra_time]).to eql([first.id, 2, 20])
      rows = Supports::Application.where(student:, kind: "extended_time").order(:id)
      expect(rows.map { |row| row.details["attempt"] }).to eql([1, 2])
    end

    it "never lowers a larger extension a teacher gave" do
      accommodate(minutes: 20)
      Quizzes::SubmissionManager.new(quiz).find_or_create_submission(student, state: "settings_only")
                                .update!(extra_time: 45)

      expect(quiz.generate_submission(student).extra_time).to be 45
    end

    it "uses the largest of several" do
      accommodate(minutes: 10)
      accommodate(multiplier: 2)

      expect(quiz.generate_submission(student).extra_time).to be 30
    end

    it "doesn't touch untimed quizzes" do
      accommodate(minutes: 20)
      submission = make_quiz.generate_submission(student)

      expect([submission.extra_time, submission.end_at]).to eql([nil, nil])
      expect(Supports::Application.count).to be 0
    end

    it "doesn't apply to a course the accommodation leaves out" do
      student_in_course(course: other_course, user: student, active_all: true)
      plan.accommodations.create!(accommodation_type: extended_time_type, parameters: { minutes: 20 }, course_ids: [other_course.id])

      expect(quiz.generate_submission(student).extra_time).to be_nil
    end

    it "ignores accommodations that ended, and archived plans" do
      accommodate(minutes: 20).update!(end_date: 1.day.ago.to_date)
      other_plan = Supports::Plan.create!(account: root_account, student:, plan_type: "iep", workflow_state: "archived")
      other_plan.accommodations.create!(accommodation_type: extended_time_type, parameters: { minutes: 25 })

      expect(quiz.generate_submission(student).extra_time).to be_nil
    end

    it "does nothing with the flag off" do
      accommodate(minutes: 20)
      root_account.disable_feature!(:supports_accommodations_apply)

      expect(quiz.generate_submission(student).extra_time).to be_nil
    end

    it "does nothing for a preview" do
      accommodate(minutes: 20)

      expect(quiz.generate_submission(student, preview: true).extra_time).to be_nil
    end
  end

  describe "a student with no accommodation" do
    it "gets exactly the attempt they would get without supports" do
      lock_at = 20.minutes.from_now
      locked_quiz = make_quiz(time_limit: 30, lock_at:)
      accommodate(minutes: 20)
      Timecop.freeze do
        with_supports = locked_quiz.generate_submission(classmate)
        columns = with_supports.reload.attributes.except("id", "created_at", "updated_at", "validation_token", "quiz_data")

        root_account.disable_feature!(:student_supports)
        Quizzes::QuizSubmissionEvent.where(quiz_submission_id: with_supports.id).delete_all
        Quizzes::QuizSubmission.where(id: with_supports.id).delete_all
        without_supports = Quizzes::Quiz.find(locked_quiz.id).generate_submission(classmate)

        expect(without_supports.reload.attributes.except("id", "created_at", "updated_at", "validation_token", "quiz_data")).to eql(columns)
        expect(with_supports.end_at).to be_within(1.second).of(lock_at)
      end
      expect(Supports::Application.where(student: classmate).count).to be 0
    end
  end

  describe "the lock date" do
    let(:lock_at) { 20.minutes.from_now }
    let(:locked_quiz) { make_quiz(time_limit: 30, lock_at:) }

    it "lets an accommodated attempt run past the lock" do
      accommodate(minutes: 30)
      submission = locked_quiz.generate_submission(student)

      expect(submission.end_at).to be_within(1.second).of(submission.started_at + 60.minutes)
      expect(submission.end_at_without_time_limit).to eql(submission.end_at)
    end

    it "keeps the quiz open for the attempt after the lock, and only for it" do
      accommodate(minutes: 30)
      submission = locked_quiz.generate_submission(student)

      Timecop.travel(30.minutes.from_now) do
        quiz = Quizzes::Quiz.find(locked_quiz.id)
        eligibility = Quizzes::QuizEligibility.new(course:, quiz:, user: student)
        expect(eligibility).not_to be_locked
        expect(submission.reload).not_to be_overdue

        finish(submission)
        expect(Quizzes::QuizEligibility.new(course:, quiz:, user: student)).to be_locked
      end
    end

    it "still cuts a student without an accommodation off at the lock" do
      submission = locked_quiz.generate_submission(classmate)

      expect(submission.end_at).to be_within(1.second).of(lock_at)
      Timecop.travel(30.minutes.from_now) do
        expect(Quizzes::QuizEligibility.new(course:, quiz: Quizzes::Quiz.find(locked_quiz.id), user: classmate)).to be_locked
      end
    end

    it "gives the full time with the timer's auto-submit turned off" do
      locked_quiz.update!(disable_timer_autosubmission: true)
      accommodate(minutes: 30)
      submission = locked_quiz.generate_submission(student)

      Timecop.travel(40.minutes.from_now) do
        expect(submission.reload).not_to be_overdue
        expect(submission.time_left(hard: true)).to be > 0
      end
    end

    it "doesn't reach past the lock with extra time a teacher gave by hand" do
      Quizzes::SubmissionManager.new(locked_quiz).find_or_create_submission(classmate, state: "settings_only")
                                .update!(extra_time: 30)

      expect(locked_quiz.generate_submission(classmate).end_at).to be_within(1.second).of(lock_at)
    end
  end

  describe "extra attempts" do
    it "raises the attempts when an attempt starts" do
      accommodate(extra_attempts_type, attempts: 2)
      submission = finish(quiz.generate_submission(student))

      expect([submission.extra_attempts, submission.attempts_left]).to eql([2, 2])
    end

    it "reaches a quiz the student already used up when the accommodation is added" do
      submission = finish(quiz.generate_submission(student))
      expect(submission.attempts_left).to be 0

      accommodate(extra_attempts_type, attempts: 1)
      Supports::Applier.sync(student.id, root_account.id)

      expect(submission.reload.attempts_left).to be 1
      expect(Supports::Application.where(student:, kind: "extra_attempts").count).to be 1
    end

    it "leaves unlimited-attempt quizzes alone" do
      accommodate(extra_attempts_type, attempts: 2)

      expect(make_quiz(allowed_attempts: -1).generate_submission(student).extra_attempts).to be_nil
    end
  end

  describe "the Moderate page" do
    it "can't take a student below their accommodation" do
      accommodate(minutes: 20)
      accommodate(extra_attempts_type, attempts: 1)
      submission = Quizzes::SubmissionManager.new(quiz).find_or_create_submission(student, state: "settings_only")
      Quizzes::QuizExtension.new(submission, { extra_time: 5, extra_attempts: 0 }).extend_submission!

      expect([submission.reload.extra_time, submission.extra_attempts]).to eql([20, 1])
    end

    it "keeps a larger extension a teacher gives" do
      accommodate(minutes: 20)
      submission = Quizzes::SubmissionManager.new(quiz).find_or_create_submission(student, state: "settings_only")
      Quizzes::QuizExtension.new(submission, { extra_time: 40 }).extend_submission!

      expect(submission.reload.extra_time).to be 40
    end

    it "lists each student's floor" do
      accommodate(minutes: 20)
      accommodate(extra_attempts_type, attempts: 1)

      expect(described_class.floors(quiz, [student.id, classmate.id])).to eql({ student.id => { minutes: 20, attempts: 1 } })
    end
  end
end
