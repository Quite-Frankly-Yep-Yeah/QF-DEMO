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
describe SelfPaced::StaffHome do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:context_module) { course.context_modules.create!(name: "Unit 1") }
  let(:now) { Time.zone.parse("2026-09-22 15:00:00 UTC") }

  def home(viewer = teacher)
    described_class.new(course, viewer, now:).as_json
  end

  def add_page(title)
    context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title:).id)
  end

  it "lists the units with item and quiz counts" do
    add_page("Lesson")
    quiz = course.quizzes.create!(title: "Check")
    context_module.add_item(type: "quiz", id: quiz.id)

    expect(home[:units]).to contain_exactly(include(name: "Unit 1", items: 2, quizzes: 1))
  end

  it "ticks off the setup steps as they are done" do
    steps = -> { home[:checklist].to_h { |s| [s[:id], s[:done]] } }
    expect(steps.call).to eql("units" => false, "estimates" => false, "students" => false, "publish" => true)

    tag = add_page("Lesson")
    SelfPaced::ItemSetting.create!(content_tag: tag, course:, role: "instruction", estimated_minutes: 10)
    student_in_course(course:, active_all: true)

    expect(steps.call).to eql("units" => true, "estimates" => true, "students" => true, "publish" => true)
  end

  it "has no class numbers before there are students" do
    expect(home[:stats]).to be_nil
  end

  it "counts students who are behind, stuck or inactive" do
    active = { last_active_at: now - 1.hour }
    rows = [{ days_behind: 4 }.merge(active), { attempts_on_current_item: 3 }.merge(active), { percent_complete: 60, last_active_at: now - 5.days }]
    rows.each do |attrs|
      student = student_in_course(course:, active_all: true).user
      SelfPaced::StudentCourseState.create!({ course:, user: student, root_account: course.root_account }.merge(attrs))
    end

    expect(home[:stats]).to include(students: 3, behind: 1, stuck: 1, inactive: 1, average_percent: 20)
  end

  it "offers the make links to a teacher" do
    expect(home[:links][:make].pluck(:id)).to include("quiz", "assignment", "page")
  end
end
