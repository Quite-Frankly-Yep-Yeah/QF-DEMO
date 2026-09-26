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

describe SelfPaced::Skills do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:jordan) { student_in_course(course:, active_all: true, name: "Jordan Kim").user }
  let_once(:sam) { student_in_course(course:, active_all: true, name: "Sam Rivera").user }
  let(:skills) { described_class.new(course) }

  def skill_json(title = "first new outcome")
    skills.as_json[:skills].find { |skill| skill[:title] == title }
  end

  def result_for(user, score)
    create_learning_outcome_result(user, score, assignment: @assignment, outcome: @outcome, alignment: @alignment)
  end

  before do
    @context = course
    outcome_model(context: course)
    create_alignment
  end

  it "lists the course's outcomes as skills, with what they are aligned to" do
    skill = skill_json

    expect(skill).to include(title: "first new outcome", description: "new outcome", mastery_points: 3.0)
    expect(skill[:aligned].pluck(:type)).to eql(["Assignment"])
    expect(skill[:aligned].first[:url]).to eql("/courses/#{course.id}/assignments/#{@assignment.id}")
  end

  it "puts each student at a level from their latest result" do
    result_for(maya, 3)
    result_for(jordan, 2.5)
    result_for(sam, 1)

    levels = skill_json[:students].to_h { |row| [row[:name], row[:level]] }
    expect(levels).to eql("Maya Lopez" => "mastered", "Jordan Kim" => "almost", "Sam Rivera" => "building")
    expect(skill_json[:counts]).to eql("mastered" => 1, "almost" => 1, "building" => 1, "not_assessed" => 0)
  end

  it "lists the lessons a student skips by mastering the skill, and how many have" do
    course.enable_feature!(:self_paced_course_player)
    course.root_account.enable_feature!(:self_paced)
    course.enable_feature!(:self_paced_test_out)
    mod = course.context_modules.create!(name: "Unit 1")
    tag = mod.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Plotting points").id)
    SelfPaced::ItemSetting.create!(content_tag: tag, course:, role: "instruction", learning_outcome: @outcome)
    result_for(maya, 3)
    run_jobs

    skill = skill_json
    expect(skill[:lessons]).to eql([{ id: tag.id.to_s, title: "Plotting points" }])
    expect(skill[:tested_out]).to eq 1
  end

  it "counts a student with no result as not started" do
    result_for(maya, 3)

    expect(skill_json[:counts]).to include("mastered" => 1, "not_assessed" => 2)
  end

  it "follows a student's result down as well as up when they retake" do
    result = result_for(maya, 3)
    result.update!(score: 1, mastery: false)

    expect(skill_json[:students].find { |row| row[:name] == "Maya Lopez" }[:level]).to eql("building")
  end

  it "lists the students who need the most help first" do
    result_for(maya, 3)
    result_for(sam, 1)

    expect(skill_json[:students].pluck(:name)).to eql(["Sam Rivera", "Jordan Kim", "Maya Lopez"])
  end

  it "sums the class and flags a skill fewer than half have mastered" do
    result_for(maya, 3)
    result_for(jordan, 1)
    result_for(sam, 1)

    summary = skills.as_json[:summary]
    expect(summary).to include(mastered_percent: 33, needing_attention: 1)
    expect(summary[:totals]).to include("mastered" => 1, "building" => 2)
  end

  it "has no percentage before anything is assessed" do
    expect(skills.as_json[:summary]).to include(mastered_percent: nil, needing_attention: 0)
  end

  it "leaves out students who are no longer active" do
    result_for(maya, 3)
    course.student_enrollments.find_by(user: maya).conclude

    expect(skills.as_json[:students]).to eql(2)
  end

  describe "#create!" do
    it "makes a skill with the standard scale and links it into the course" do
      outcome = skills.create!(title: "Read a bar graph", description: "From a table")

      expect(outcome).to be_persisted
      expect(outcome.mastery_points).to eql(3.0)
      expect(outcome.rubric_criterion[:ratings].pluck(:points).map(&:to_i)).to eql([4, 3, 2, 1, 0])
      expect(skills.as_json[:skills].pluck(:title)).to include("Read a bar graph")
    end

    it "needs a name" do
      expect { skills.create!(title: " ") }.to raise_error(ActiveRecord::RecordInvalid)
    end
  end
end
