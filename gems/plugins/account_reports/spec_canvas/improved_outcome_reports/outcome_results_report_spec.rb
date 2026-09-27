# frozen_string_literal: true

#
# Copyright (C) 2013 - present Instructure, Inc.
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

require_relative "../report_spec_helper"
require_relative "shared/shared_examples"
require_relative "shared/improved_outcome_reports_spec_helpers"
require_relative "shared/setup"

describe "OutcomeResultsReport" do
  include ReportSpecHelper
  include ImprovedOutcomeReportsSpecHelpers

  include_context "setup"

  let(:report_type) { "outcome_results_csv" }
  let(:expected_headers) { AccountReports::ImprovedOutcomeReports::OutcomeResultsReport::HEADERS }
  let(:all_values) { [user1_values] }
  let(:order) { [0, 2, 3, 13, 18] }

  it_behaves_like "common outcomes report behavior"

  context "with quiz question results" do
    before(:once) do
      @outcome_group = @root_account.root_outcome_group
      @quiz_outcome = @root_account.created_learning_outcomes.create!(short_description: "new outcome")
      @quiz = @course1.quizzes.create!(title: "quiz", shuffle_answers: true, quiz_type: "assignment")
      @q1 = @quiz.quiz_questions.create!(question_data: true_false_question_data)
      @q2 = @quiz.quiz_questions.create!(question_data: multiple_choice_question_data)
      bank = @q1.assessment_question.assessment_question_bank
      bank.assessment_questions.create!(question_data: true_false_question_data)
      @quiz_outcome.align(bank, @root_account, mastery_score: 0.7)
      answer_1 = @q1.question_data[:answers].detect { |a| a[:weight] == 100 }[:id]
      answer_2 = @q2.question_data[:answers].detect { |a| a[:weight] == 100 }[:id]
      @quiz.generate_quiz_data(persist: true)
      @quiz_submission = @quiz.generate_submission(@user)
      @quiz_submission.submission_data = {}
      @quiz_submission.submission_data["question_#{@q1.id}"] = answer_1
      @quiz_submission.submission_data["question_#{@q2.id}"] = answer_2 + 1
      Quizzes::SubmissionGrader.new(@quiz_submission).grade_submission
      @quiz_outcome.reload
      @outcome_group.add_outcome(@quiz_outcome)
      @quiz_outcome_result = LearningOutcomeResult.find_by(artifact: @quiz_submission)
      @new_quiz = @course1.assignments.create!(title: "New Quiz", submission_types: "external_tool")
      @new_quiz_submission = @new_quiz.grade_student(@user1, grade: "10", grader: @teacher).first
      @new_quiz_submission.submission_type = "basic_lti_launch"
      @new_quiz_submission.submitted_at = 1.week.ago
      @new_quiz_submission.save!
    end

    it "works with quizzes" do
      common_quiz_values = {
        user: @user2,
        quiz: @quiz,
        quiz_submission: @quiz_submission,
        outcome: @quiz_outcome,
        outcome_group: @outcome_group,
        course: @course1,
        assignment: @quiz.assignment,
        section: @section,
        quiz_outcome_result: @quiz_outcome_result
      }
      verify_all(
        report, [
          {
            **common_quiz_values,
            question: @q1.assessment_question,
            outcome_result: LearningOutcomeQuestionResult.find_by(
              learning_outcome_result: @quiz_outcome_result,
              associated_asset: @q1.assessment_question
            )
          },
          {
            **common_quiz_values,
            question: @q2.assessment_question,
            outcome_result: LearningOutcomeQuestionResult.find_by(
              learning_outcome_result: @quiz_outcome_result,
              associated_asset: @q2.assessment_question
            )
          },
          user1_values
        ]
      )
    end

    it "includes ratings for quiz questions" do
      expect(report[0]["assessment type"]).to eq "quiz"
      expect(report[0]["learning outcome rating"]).to eq "Does Not Meet Expectations"
    end

    context "ordering param" do
      def validate_outcome_ordering(outcome_report, expected_result)
        expected_result = nil unless AccountReports::ImprovedOutcomeReports::OutcomeResultsReport::ORDER_OPTIONS.include? expected_result
        add_text_calls = expected_result.nil? ? 0 : 1

        expect(outcome_report).to receive(:add_extra_text).exactly(add_text_calls).time
        outcome_report.send(:add_outcome_order_text)

        expect(outcome_report.send(:determine_order_key)).to eq expected_result

        # default ordering is users
        expected_result = "users" if expected_result.nil?
        expect(outcome_report.send(:outcome_order)).to eq AccountReports::ImprovedOutcomeReports::OutcomeResultsReport::ORDER_SQL[expected_result]
      end

      it "order key is valid" do
        test_cases = %w[users courses outcomes USERS COURSES OUTCOMES Users usErS foo bar]
        test_cases.each do |test|
          account_report = AccountReport.new(report_type: "outcome_export_csv", account: @root_account, user: @user1)
          account_report.parameters = { "order" => test }
          outcome_report = AccountReports::ImprovedOutcomeReports::OutcomeResultsReport.new(account_report)
          validate_outcome_ordering(outcome_report, test.downcase)
        end
      end

      it "order key is nil if ordering is not present" do
        account_report = AccountReport.new(report_type: "outcome_export_csv", account: @root_account, user: @user1)
        outcome_report = AccountReports::ImprovedOutcomeReports::OutcomeResultsReport.new(account_report)
        validate_outcome_ordering(outcome_report, nil)
      end
    end

    context "With Account Level Mastery" do
      before(:once) do
        user1_values[:outcome_result]
        @outcome_proficiency = OutcomeProficiency.new(id: 1,
                                                      root_account_id: @root_account.id,
                                                      context_type: "Account",
                                                      context: @root_account,
                                                      outcome_proficiency_ratings: [OutcomeProficiencyRating.new(
                                                        id: 1,
                                                        points: 5,
                                                        color: "3ADF00",
                                                        description: "High Rating",
                                                        mastery: false,
                                                        outcome_proficiency: @outcome_proficiency
                                                      ),
                                                                                    OutcomeProficiencyRating.new(
                                                                                      id: 2,
                                                                                      points: 3,
                                                                                      color: "FFFF00",
                                                                                      description: "Mastery Rating",
                                                                                      mastery: true,
                                                                                      outcome_proficiency: @outcome_proficiency
                                                                                    ),
                                                                                    OutcomeProficiencyRating.new(
                                                                                      id: 3,
                                                                                      points: 1,
                                                                                      color: "FF0000",
                                                                                      description: "Low Rating",
                                                                                      mastery: false,
                                                                                      outcome_proficiency: @outcome_proficiency
                                                                                    )])
        @root_account.outcome_proficiency = @outcome_proficiency
        @root_account.set_feature_flag!(:account_level_mastery_scales, "on")
      end

      it "operates as before when the feature flag is disabled" do
        @root_account.set_feature_flag!(:account_level_mastery_scales, "off")
        expect(report[0]["assessment type"]).to eq "quiz"
        expect(report[0]["learning outcome rating"]).to eq "Does Not Meet Expectations"
        expect(report[0]["learning outcome points possible"]).to eq "45.0"
      end

      it "runs the report and use the outcome proficiencies" do
        report[0]
        expect(report[0]["learning outcome rating"]).to eq "Low Rating"
        expect(report[1]["learning outcome rating"]).to eq "Low Rating"
        expect(report[2]["learning outcome rating"]).to eq "Mastery Rating"
      end

      it "uses the total percent to calculate the rating as opposed to score" do
        @outcome_proficiency.outcome_proficiency_ratings[0].points = 2
        @outcome_proficiency.outcome_proficiency_ratings[1].points = 1
        @outcome_proficiency.outcome_proficiency_ratings[2].points = 0
        @outcome_proficiency.save!
        expect(report[0]["learning outcome rating"]).to eq "Low Rating"
      end

      it "uses the score to create a ratio when calculating rating" do
        @outcome.learning_outcome_results[0].score = 3.0
        @outcome.learning_outcome_results[0].original_score = 3.0
        @outcome.learning_outcome_results[0].percent = 1.0
        @outcome.learning_outcome_results[0].save!
        @outcome_proficiency.outcome_proficiency_ratings[0].points = 50
        @outcome_proficiency.outcome_proficiency_ratings[1].points = 30
        @outcome_proficiency.outcome_proficiency_ratings[2].points = 10
        @outcome_proficiency.save!
        expect(report[0]["learning outcome rating"]).to eq "Low Rating"
        expect(report[1]["learning outcome rating"]).to eq "Low Rating"
        expect(report[2]["learning outcome rating"]).to eq "High Rating"
        expect(report[0]["learning outcome points possible"]).to eq "45.0"
        expect(report[2]["learning outcome points possible"]).to eq "50.0"
      end

      it "has no rating if the score and total_percent are nil" do
        @outcome.learning_outcome_results[0].score = nil
        @outcome.learning_outcome_results[0].original_score = nil
        @outcome.learning_outcome_results[0].percent = nil
        @outcome.learning_outcome_results[0].save!
        expect(report[0]["learning outcome rating"]).to eq "Low Rating"
        expect(report[1]["learning outcome rating"]).to eq "Low Rating"
        expect(report[2]["learning outcome rating"]).to be_nil
      end
    end

    context "With Course Level Mastery" do
      before(:once) do
        @outcome_proficiency = OutcomeProficiency.new(id: 1,
                                                      root_account_id: @root_account.id,
                                                      context_type: "Course",
                                                      context: @course1,
                                                      outcome_proficiency_ratings: [OutcomeProficiencyRating.new(
                                                        id: 1,
                                                        points: 5,
                                                        color: "3ADF00",
                                                        description: "High Rating",
                                                        mastery: false,
                                                        outcome_proficiency: @outcome_proficiency
                                                      ),
                                                                                    OutcomeProficiencyRating.new(
                                                                                      id: 2,
                                                                                      points: 3,
                                                                                      color: "FFFF00",
                                                                                      description: "Mastery Rating",
                                                                                      mastery: true,
                                                                                      outcome_proficiency: @outcome_proficiency
                                                                                    ),
                                                                                    OutcomeProficiencyRating.new(
                                                                                      id: 3,
                                                                                      points: 1,
                                                                                      color: "FF0000",
                                                                                      description: "Low Rating",
                                                                                      mastery: false,
                                                                                      outcome_proficiency: @outcome_proficiency
                                                                                    )])
        @course1.outcome_proficiency = @outcome_proficiency
        @root_account.set_feature_flag!(:account_level_mastery_scales, "on")
      end

      it "runs the report and use the course outcome proficiencies" do
        report[0]
        expect(report[0]["learning outcome rating"]).to eq "Low Rating"
        expect(report[1]["learning outcome rating"]).to eq "Low Rating"
        expect(report[2]["learning outcome rating"]).to eq "Mastery Rating"
        expect(report[0]["learning outcome points possible"]).to eq "45.0"
        expect(report[2]["learning outcome points possible"]).to eq "5.0"
      end
    end
  end

  context "GuardRail usage" do
    it "queries scopes on secondary/report replica" do
      guardrail_environments_during_outcomes_call = []

      report_class = AccountReports::ImprovedOutcomeReports::OutcomeResultsReport
      outcome_results_scope_method = report_class.instance_method(:outcome_results_scope)

      allow_any_instance_of(report_class).to receive(:outcome_results_scope) do |instance|
        guardrail_environments_during_outcomes_call << GuardRail.environment
        outcome_results_scope_method.bind_call(instance)
      end

      read_report(report_type, { order:, parse_header: true, account: @root_account })

      expect(guardrail_environments_during_outcomes_call).to all(be_in([:secondary, :report]))
    end
  end
end
