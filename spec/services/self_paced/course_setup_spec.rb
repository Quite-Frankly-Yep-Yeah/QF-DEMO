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

describe SelfPaced::CourseSetup do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:unit1) { course.context_modules.create!(name: "Unit 1") }
  let_once(:unit2) { course.context_modules.create!(name: "Unit 2") }
  let_once(:page_tag) { unit1.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson").id) }
  let_once(:video_tag) { unit1.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Video lesson").id) }
  let_once(:practice) { course.assignments.create!(title: "Classwork", submission_types: "online_text_entry", points_possible: 5) }
  let_once(:practice_tag) { unit1.add_item(type: "assignment", id: practice.id) }
  let_once(:check) { course.assignments.create!(title: "Check", submission_types: "online_text_entry", points_possible: 10) }
  let_once(:check_tag) { unit1.add_item(type: "assignment", id: check.id) }
  let_once(:header_tag) { unit2.add_item(type: "context_module_sub_header", title: "Lesson 2") }

  let(:setup) { described_class.new(Course.find(course.id)) }

  def requirements(mod)
    ContextModule.find(mod.id).completion_requirements
  end

  describe "#as_json" do
    it "suggests a role for every item from its type" do
      roles = setup.as_json[:modules].flat_map { |m| m[:items] }.to_h { |i| [i[:title], i[:role]] }

      expect(roles).to include("Lesson" => "instruction", "Check" => "practice", "Lesson 2" => "none")
    end

    it "uses a 70% mastery threshold until the teacher picks one" do
      expect(setup.as_json[:mastery_threshold]).to be 70.0
    end
  end

  describe "#apply!" do
    before do
      setup.apply!(mastery_threshold: 80,
                   items: [{ id: video_tag.id, role: "instruction", watch_fraction: 0.95 },
                           { id: check_tag.id, role: "check", max_attempts: 3 }])
    end

    it "turns roles into native requirements" do
      expect(requirements(unit1)).to eql([
                                           { id: page_tag.id, type: "must_view" },
                                           { id: video_tag.id, type: "must_watch" },
                                           { id: practice_tag.id, type: "must_submit" },
                                           { id: check_tag.id, type: "min_percentage", min_percentage: 80.0 }
                                         ])
    end

    it "makes items unlock in order and each unit require the one before it" do
      unit2_now = ContextModule.find(unit2.id)

      expect([ContextModule.find(unit1.id).require_sequential_progress, unit2_now.require_sequential_progress]).to eql([true, true])
      expect(unit2_now.prerequisites.pluck(:id)).to eql([unit1.id])
    end

    it "gives checks the configured number of attempts" do
      expect(check.reload.allowed_attempts).to be 3
    end

    it "lets an item override the course threshold" do
      setup.apply!(items: [{ id: check_tag.id, role: "check", mastery_threshold: 90 }])

      expect(requirements(unit1).last).to eql({ id: check_tag.id, type: "min_percentage", min_percentage: 90.0 })
    end
  end

  it "scores Classic Quiz checks by the latest attempt" do
    quiz = course.quizzes.create!(title: "Quiz check", quiz_type: "assignment", points_possible: 10)
    quiz.publish!
    quiz_tag = unit1.add_item(type: "quiz", id: quiz.id)
    setup.apply!(items: [{ id: quiz_tag.id, role: "check", max_attempts: 2 }])

    expect(quiz.reload.slice(:scoring_policy, :allowed_attempts)).to eql("scoring_policy" => "keep_latest", "allowed_attempts" => 2)
  end
end
