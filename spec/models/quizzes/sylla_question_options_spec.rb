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
describe "quite frankly an example LMS question options" do
  def generate(type, **fields)
    Quizzes::QuizQuestion::QuestionData.generate({ question_type: "#{type}_question" }.merge(fields))
  end

  describe Quizzes::QuizQuestion::QuestionData do
    it "keeps a numeric question's unit and the unit choices" do
      data = generate(:numerical, sylla_unit: " cm ", sylla_unit_choices: "mm, cm, m")

      expect(data).to include(sylla_unit: "cm", sylla_unit_choices: "mm, cm, m")
    end

    it "keeps a hotspot's image and regions on a multiple choice question" do
      data = generate(:multiple_choice, sylla_image: "/images/x.png", sylla_regions: "A | 1 | 2 | 3 | 4")

      expect(data).to include(sylla_image: "/images/x.png", sylla_regions: "A | 1 | 2 | 3 | 4")
    end

    it "refuses an image that isn't a web or site address, and drops regions without one" do
      data = generate(:multiple_choice, sylla_image: "javascript:alert(1)", sylla_regions: "A | 1 | 2 | 3 | 4")

      expect(data[:sylla_image]).to be_nil
      expect(data[:sylla_regions]).to be_nil
    end

    it "keeps the confidence prompt on any type, and only when it is on" do
      expect(generate(:short_answer, sylla_confidence: "1")[:sylla_confidence]).to eql("1")
      expect(generate(:multiple_choice, sylla_confidence: "1")[:sylla_confidence]).to eql("1")
      expect(generate(:multiple_choice, sylla_confidence: "")[:sylla_confidence]).to be_nil
    end
  end

  describe Quizzes::QuizQuestion::NumericalQuestion do
    let(:answers) { [{ id: 1, weight: 100, numerical_answer_type: "exact_answer", exact: 5, margin: 0 }] }

    def score(data, params)
      Quizzes::SubmissionGrader.score_question(data.merge(id: 1, question_type: "numerical_question", points_possible: 1, answers:), params)
    end

    it "ignores units when the question has none" do
      expect(score({}, { "question_1" => "5" })[:correct]).to be true
    end

    it "needs the right unit when the question has one" do
      data = { sylla_unit: "cm", sylla_unit_choices: "mm, cm, m" }

      expect(score(data, { "question_1" => "5", "question_1_unit" => "cm" })[:correct]).to be true
      expect(score(data, { "question_1" => "5", "question_1_unit" => "CM" })[:correct]).to be true
      expect(score(data, { "question_1" => "5", "question_1_unit" => "m" })[:correct]).to be false
      expect(score(data, { "question_1" => "5" })[:correct]).to be false
    end

    it "still needs the right number" do
      data = { sylla_unit: "cm", sylla_unit_choices: "mm, cm" }

      expect(score(data, { "question_1" => "6", "question_1_unit" => "cm" })[:correct]).to be false
    end
  end

  describe Quizzes::SubmissionGrader do
    def score(extra, params)
      described_class.score_question({ id: 1,
                                       question_type: "numerical_question",
                                       points_possible: 1,
                                       answers: [{ id: 1, weight: 100, numerical_answer_type: "exact_answer", exact: 5, margin: 0 }] }.merge(extra),
                                     params)
    end

    it "keeps how sure the student said they were, when the question asks" do
      result = score({ sylla_confidence: "1" }, { "question_1" => "5", "question_1_confidence" => "sure" })

      expect(result[:confidence]).to eql("sure")
    end

    it "ignores confidence on a question that doesn't ask, and anything that isn't a level" do
      expect(score({}, { "question_1" => "5", "question_1_confidence" => "sure" })).not_to have_key(:confidence)
      expect(score({ sylla_confidence: "1" }, { "question_1" => "5", "question_1_confidence" => "certain" })).not_to have_key(:confidence)
    end

    it "keeps the unit picked" do
      result = score({ sylla_unit_choices: "mm, cm" }, { "question_1" => "5", "question_1_unit" => "cm" })

      expect(result[:unit]).to eql("cm")
    end
  end
end
