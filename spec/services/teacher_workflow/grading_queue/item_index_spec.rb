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
describe TeacherWorkflow::GradingQueue::ItemIndex do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:mod) { course.context_modules.create!(name: "Unit 1") }
  let_once(:assignment) { course.assignments.create!(title: "Check", points_possible: 10, submission_types: "online_text_entry") }
  let_once(:tag) { mod.add_item(type: "assignment", id: assignment.id) }

  it "finds the module item, unit and order for an assignment" do
    tag
    item = described_class.new(course).for_assignment(assignment)
    expect(item.tag).to eq tag
    expect(item.unit_name).to eq "Unit 1"
    expect(item.order).to eq [mod.position.to_i, tag.position.to_i]
    expect(item.grade_requirement).to be false
  end

  it "reports a min_percentage requirement as a grade requirement" do
    mod.completion_requirements = [{ id: tag.id, type: "min_percentage", min_percentage: 70 }]
    mod.save!
    expect(described_class.new(course.reload).for_assignment(assignment).grade_requirement).to be true
  end

  it "finds a quiz's item through the quiz's assignment" do
    quiz = course.quizzes.create!(title: "Quiz", quiz_type: "assignment")
    quiz.publish!
    quiz_tag = mod.add_item(type: "quiz", id: quiz.id)
    expect(described_class.new(course).for_assignment(quiz.reload.assignment).tag).to eq quiz_tag
  end

  it "finds an item by its tag id" do
    expect(described_class.new(course).for_tag_id(tag.id).tag).to eq tag
  end

  it "returns nil for an assignment that is in no module" do
    other = course.assignments.create!(title: "Loose", points_possible: 1)
    expect(described_class.new(course).for_assignment(other)).to be_nil
  end
end
