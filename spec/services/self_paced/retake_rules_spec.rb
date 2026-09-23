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

describe SelfPaced::RetakeRules do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:context_module) { course.context_modules.create!(name: "Unit 1") }
  let_once(:lesson_tag) { context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson 1.1").id) }
  let_once(:quiz) do
    # publishing recomputes points from the questions (none here), so set them after
    course.quizzes.create!(title: "Check 1.1", quiz_type: "assignment", allowed_attempts: 3).tap do |q|
      q.publish!
      q.update_column(:points_possible, 10)
    end
  end
  let_once(:quiz_tag) { context_module.add_item(type: "quiz", id: quiz.id) }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.enable_feature!(:self_paced_course_player)
    lesson_tag
    SelfPaced::ItemSetting.create!(content_tag: quiz_tag, course:, role: "check", retake_review: true)
  end

  # a finished attempt with +score+ out of 10, an hour ago
  def attempt!(score)
    submission = quiz.generate_submission(student)
    submission.update_columns(workflow_state: "complete", score:, kept_score: score, finished_at: 1.hour.ago)
  end

  def reopen_lesson!
    SelfPaced::ItemTime.create!(user: student,
                                course:,
                                content_tag: lesson_tag,
                                root_account: course.root_account,
                                active_seconds: 60,
                                first_viewed_at: 5.minutes.ago,
                                last_viewed_at: 5.minutes.ago)
  end

  describe ".review_items_to_revisit" do
    it "asks a student who missed mastery to reopen the lesson before the check" do
      attempt!(4)

      expect(described_class.review_items_to_revisit(quiz, student)).to eql([lesson_tag])
    end

    it "is satisfied once the student has reopened the lesson since the attempt" do
      attempt!(4)
      reopen_lesson!

      expect(described_class.review_pending?(quiz, student)).to be false
    end

    it "doesn't count a lesson view from before the attempt" do
      attempt!(4)
      SelfPaced::ItemTime.create!(user: student,
                                  course:,
                                  content_tag: lesson_tag,
                                  root_account: course.root_account,
                                  active_seconds: 60,
                                  first_viewed_at: 2.hours.ago,
                                  last_viewed_at: 2.hours.ago)

      expect(described_class.review_pending?(quiz, student)).to be true
    end

    it "asks for nothing after an attempt that reached mastery" do
      attempt!(9)

      expect(described_class.review_pending?(quiz, student)).to be false
    end

    it "asks for nothing before the first attempt" do
      expect(described_class.review_pending?(quiz, student)).to be false
    end

    it "asks for nothing when the check doesn't require review" do
      attempt!(4)
      SelfPaced::ItemSetting.find_by(content_tag: quiz_tag).update!(retake_review: false)

      expect(described_class.review_pending?(quiz, student)).to be false
    end
  end

  describe "quiz eligibility" do
    def eligibility
      Quizzes::QuizEligibility.new(course:, quiz:, user: student)
    end

    it "blocks the next try and says why until the lesson is reopened" do
      attempt!(4)

      expect([eligibility.eligible?, eligibility.declined_reason_renders]).to eql([false, :retake_review_required])

      reopen_lesson!
      expect(eligibility.eligible?).to be true
    end
  end
end
