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

describe SelfPaced::PlayerMap do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:unit) { course.context_modules.create!(name: "Unit 1") }
  # sub-headers start unpublished, and students only see published ones
  let_once(:header_tag) { unit.add_item(type: "context_module_sub_header", title: "Lesson 1.1").tap(&:publish!) }
  let_once(:lesson_tag) { unit.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "1.1 Lesson").id) }
  let_once(:practice) { course.assignments.create!(title: "1.1 Classwork", submission_types: "online_text_entry", points_possible: 5) }
  let_once(:practice_tag) { unit.add_item(type: "assignment", id: practice.id) }
  let_once(:next_tag) { unit.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "1.2 Lesson").id) }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.enable_feature!(:self_paced_course_player)
    header_tag
    unit.update!(require_sequential_progress: true,
                 completion_requirements: [{ id: lesson_tag.id, type: "must_view" },
                                           { id: practice_tag.id, type: "must_submit" },
                                           { id: next_tag.id, type: "must_view" }])
  end

  def map_for(user)
    described_class.new(Course.find(course.id), user).as_json
  end

  def statuses(map)
    map[:units].first[:items].to_h { |item| [item[:title], item[:status] || item[:type]] }
  end

  it "shows what the student has done, what they're on, and what is locked" do
    lesson_tag.context_module_action(student, :read)

    expect(statuses(map_for(student))).to eql(
      "Lesson 1.1" => "header",
      "1.1 Lesson" => "completed",
      "1.1 Classwork" => "current",
      "1.2 Lesson" => "locked"
    )
  end

  it "points the student at the step to continue with" do
    lesson_tag.context_module_action(student, :read)

    expect(map_for(student)[:current_item]).to include(id: practice_tag.id.to_s, title: "1.1 Classwork")
  end

  it "shows an unlocked item as open" do
    SelfPaced::ItemOverride.create!(content_tag: next_tag, user: student, kind: "unlock")
    RequestCache.clear

    expect(statuses(map_for(student))["1.2 Lesson"]).to eql("available")
  end

  it "labels items with their role and a link" do
    item = map_for(student)[:units].first[:items].find { |i| i[:title] == "1.1 Classwork" }

    expect(item).to include(role: "practice", url: "/courses/#{course.id}/modules/items/#{practice_tag.id}")
  end

  it "shows teachers every step as open" do
    expect(statuses(map_for(teacher)).values.uniq).to match_array(%w[header available])
  end
end
