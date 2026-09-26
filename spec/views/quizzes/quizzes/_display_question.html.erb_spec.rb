# frozen_string_literal: true

#
# Copyright (C) 2011 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

require_relative "../../views_helper"

describe "quizzes/quizzes/_display_question" do
  it "renders" do
    course_with_student
    view_context

    @quiz = @course.quizzes.create!(title: "new quiz")
    @quiz.quiz_questions.create!(question_data: { :name => "LTUE",
                                                  :points_possible => 1,
                                                  "question_type" => "numerical_question",
                                                  "correct_comments_html" => '<img class="equation_image" title="\sqrt{1764}" src="/equation_images/%255Csqrt%257B9%257D" alt="LaTeX: \sqrt{1764}" data-equation-content="\sqrt{1764}" />',
                                                  "answers" => { "answer_0" => { "numerical_answer_type" => "exact_answer",
                                                                                 "answer_exact" => 42,
                                                                                 "answer_text" => "",
                                                                                 "answer_weight" => "100" } } })
    @quiz.generate_quiz_data
    @quiz.save

    @submission = @quiz.generate_submission(@student)
    @submission.submission_data = { "question_#{@quiz.quiz_data[0][:id]}" => "42.0" }
    Quizzes::SubmissionGrader.new(@submission).grade_submission

    assign(:quiz, @quiz)
    q = @quiz.stored_questions.first
    q[:answers][0].delete(:margin) # sometimes this is missing; see #10785
    render partial: "quizzes/quizzes/display_question", object: q, locals: {
      user_answer: @submission.submission_data.find { |a| a[:question_id] == q[:id] },
      assessment_results: true
    }
    expect(response).not_to be_nil
    expect(response.body).to include "data-equation-content"
  end

  it "marks a matching question with its layout for the take page" do
    course_with_student
    view_context
    @quiz = @course.quizzes.create!(title: "sorting")
    @quiz.quiz_questions.create!(question_data: { name: "Sort",
                                                  points_possible: 1,
                                                  question_type: "matching_question",
                                                  sylla_layout: "categorize",
                                                  answers: [{ answer_match_left: "Oak", answer_match_right: "Tree", answer_weight: 100 }] })
    @quiz.generate_quiz_data
    @quiz.save
    assign(:quiz, @quiz)
    q = @quiz.stored_questions.first

    render partial: "quizzes/quizzes/display_question", object: q, locals: { user_answer: nil, assessment_results: false }

    expect(response.body).to include 'data-sylla-layout="categorize"'
  end

  it "never gives a student the correct unit, but does give the choices" do
    course_with_student
    view_context
    @quiz = @course.quizzes.create!(title: "units")
    @quiz.quiz_questions.create!(question_data: { name: "Length",
                                                  points_possible: 1,
                                                  question_type: "numerical_question",
                                                  sylla_unit: "SECRETUNIT",
                                                  sylla_unit_choices: "mm, cm, SECRETUNIT",
                                                  sylla_confidence: "1",
                                                  answers: [{ numerical_answer_type: "exact_answer", answer_exact: 5, answer_error_margin: 0, answer_weight: 100 }] })
    @quiz.generate_quiz_data
    @quiz.save
    assign(:quiz, @quiz)
    q = @quiz.stored_questions.first

    render partial: "quizzes/quizzes/display_question", object: q, locals: { user_answer: nil }
    expect(response.body).to include 'data-sylla-unit-choices="mm, cm, SECRETUNIT"'
    expect(response.body).to include 'data-sylla-confidence="1"'
    expect(response.body).not_to include('class="sylla_unit"')

    render partial: "quizzes/quizzes/display_question", object: q, locals: { editing: true }
    expect(response.body).to include('class="sylla_unit"')
  end

  it "shows a student how sure they were on their results, with a nudge when they were sure and wrong" do
    course_with_student
    view_context
    @quiz = @course.quizzes.create!(title: "sure")
    @quiz.quiz_questions.create!(question_data: { name: "Q", points_possible: 1, question_type: "numerical_question", sylla_confidence: "1",
                                                  answers: [{ numerical_answer_type: "exact_answer", answer_exact: 5, answer_error_margin: 0, answer_weight: 100 }] })
    @quiz.generate_quiz_data
    @quiz.save
    submission = @quiz.generate_submission(@student)
    submission.submission_data = { "question_#{@quiz.quiz_data[0][:id]}" => "9", "question_#{@quiz.quiz_data[0][:id]}_confidence" => "sure" }
    Quizzes::SubmissionGrader.new(submission).grade_submission
    assign(:quiz, @quiz)
    q = @quiz.stored_questions.first

    render partial: "quizzes/quizzes/display_question", object: q, locals: {
      user_answer: submission.submission_data.find { |a| a[:question_id] == q[:id] },
      assessment_results: true
    }

    expect(response.body).to include("How sure you were: sure")
    expect(response.body).to include("worth a second look")
  end
end
