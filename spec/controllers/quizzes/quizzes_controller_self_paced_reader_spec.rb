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

describe Quizzes::QuizzesController do
  render_views

  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let(:quiz) do
    q = course.quizzes.create!(title: "Reading check")
    q.quiz_questions.create!(question_data: { name: "Q1", question_type: "true_false_question", question_text: "True?", answers: [{ text: "True", weight: 100 }, { text: "False", weight: 0 }], points_possible: 1 })
    q.publish!
    q
  end

  def take
    quiz.generate_submission(student)
    user_session(student)
    get "show", params: { course_id: course.id, quiz_id: quiz.id, take: "1" }
  end

  describe "GET show (taking)" do
    it "uses the classic layout while the flag is off" do
      take
      expect(response.body).not_to include("self-paced-quiz")
    end

    it "uses the reader layout while self_paced_quiz_reader is on" do
      course.root_account.enable_feature!(:self_paced)
      course.enable_feature!(:self_paced_quiz_reader)
      take
      expect(response.body).to match(/<body[^>]*self-paced-quiz/)
    end

    it "keeps the classic layout for one-question-at-a-time quizzes" do
      course.root_account.enable_feature!(:self_paced)
      course.enable_feature!(:self_paced_quiz_reader)
      quiz.update!(one_question_at_a_time: true)
      take
      expect(response.body).not_to match(/<body[^>]*self-paced-quiz/)
    end
  end
end
