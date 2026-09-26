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
describe SelfPaced::TestOut do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:jordan) { student_in_course(course:, active_all: true, name: "Jordan Kim").user }
  let_once(:context_module) { course.context_modules.create!(name: "Unit 1") }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.enable_feature!(:self_paced_course_player)
    course.enable_feature!(:self_paced_test_out)
    @context = course
    outcome_model(context: course, title: "Graph a line")
    create_alignment
    @graphing = @outcome
    outcome_model(context: course, title: "Solve equations")
    @solving = @outcome
  end

  def lesson(title, skill: @graphing, role: "instruction")
    page = course.wiki_pages.create!(title:)
    tag = context_module.add_item(type: "wiki_page", id: page.id)
    SelfPaced::ItemSetting.create!(content_tag: tag, course:, role:, learning_outcome: skill)
    tag
  end

  def master(user, outcome = @graphing, score: 3)
    create_learning_outcome_result(user, score, assignment: @assignment, outcome:, alignment: @alignment)
  end

  def exempt?(user, tag)
    SelfPaced::ItemOverride.active.where(user:, content_tag: tag, kind: "exempt").exists?
  end

  describe ".apply" do
    it "exempts the lessons that teach a skill once the student has mastered it" do
      first = lesson("Plotting points")
      second = lesson("Slope", role: "practice")
      master(maya)

      exempted = described_class.apply(course.id, maya.id, @graphing.id)

      expect(exempted).to contain_exactly(first, second)
      expect(exempt?(maya, first)).to be true
      override = SelfPaced::ItemOverride.find_by(user: maya, content_tag: first)
      expect(override).to have_attributes(created_by: nil, learning_outcome_id: @graphing.id, reason: "Tested out: mastered Graph a line")
    end

    it "leaves a student who hasn't mastered the skill alone" do
      tag = lesson("Plotting points")
      master(maya, score: 1)
      described_class.apply(course.id, maya.id, @graphing.id)

      expect(exempt?(maya, tag)).to be false
    end

    it "only skips lessons for the skill that was mastered, and only for that student" do
      graphing = lesson("Plotting points")
      solving = lesson("One-step equations", skill: @solving)
      master(maya)
      described_class.apply(course.id, maya.id, @graphing.id)

      expect(exempt?(maya, solving)).to be false
      expect(exempt?(jordan, graphing)).to be false
    end

    it "never excuses a graded item" do
      graded = assignment_model(course:, points_possible: 10, title: "Graded practice")
      tag = context_module.add_item(type: "assignment", id: graded.id)
      SelfPaced::ItemSetting.create!(content_tag: tag, course:, role: "practice", learning_outcome: @graphing)
      master(maya)
      described_class.apply(course.id, maya.id, @graphing.id)

      expect(exempt?(maya, tag)).to be false
    end

    it "is one-way: a worse result later doesn't give the lessons back" do
      tag = lesson("Plotting points")
      result = master(maya)
      described_class.apply(course.id, maya.id, @graphing.id)
      result.update!(score: 1, mastery: false)
      described_class.apply(course.id, maya.id, @graphing.id)

      expect(exempt?(maya, tag)).to be true
    end

    it "doesn't exempt twice" do
      lesson("Plotting points")
      master(maya)
      described_class.apply(course.id, maya.id, @graphing.id)

      expect(described_class.apply(course.id, maya.id, @graphing.id)).to be_empty
      expect(SelfPaced::ItemOverride.active.where(user: maya).count).to eq 1
    end

    it "does nothing while test-out is off" do
      tag = lesson("Plotting points")
      master(maya)
      course.disable_feature!(:self_paced_test_out)
      described_class.apply(course.id, maya.id, @graphing.id)

      expect(exempt?(maya, tag)).to be false
    end
  end

  describe "when a mastery result comes in" do
    it "skips the lessons in the background" do
      tag = lesson("Plotting points")
      master(maya)
      run_jobs

      expect(exempt?(maya, tag)).to be true
    end

    it "does nothing for a result that isn't a mastery" do
      tag = lesson("Plotting points")
      master(maya, score: 1)
      run_jobs

      expect(exempt?(maya, tag)).to be false
    end
  end

  describe ".sweep" do
    it "catches up students who mastered a skill before a lesson was tied to it" do
      master(maya)
      run_jobs
      tag = lesson("Plotting points")
      described_class.sweep(course.id)

      expect(exempt?(maya, tag)).to be true
      expect(exempt?(jordan, tag)).to be false
    end
  end

  describe ".tested_out_counts" do
    it "counts the students who have tested out, per skill" do
      lesson("Plotting points")
      master(maya)
      master(jordan)
      run_jobs

      expect(described_class.tested_out_counts(course)).to eql(@graphing.id => 2)
    end
  end

  describe SelfPaced::ItemSetting do
    it "only lets a lesson or practice item teach a skill" do
      page = course.wiki_pages.create!(title: "Quiz-ish")
      tag = context_module.add_item(type: "wiki_page", id: page.id)
      setting = described_class.new(content_tag: tag, course:, role: "check", learning_outcome: @graphing)

      expect(setting).not_to be_valid
      expect(setting.errors[:learning_outcome_id].join).to include("lessons and practice")
    end

    it "only lets a course's own skills be used" do
      other = course_factory(active_all: true)
      foreign = outcome_model(context: other, title: "Theirs")
      page = course.wiki_pages.create!(title: "Lesson")
      tag = context_module.add_item(type: "wiki_page", id: page.id)
      setting = described_class.new(content_tag: tag, course:, role: "instruction", learning_outcome: foreign)

      expect(setting).not_to be_valid
      expect(setting.errors[:learning_outcome_id].join).to include("isn't a skill in this course")
    end
  end
end
