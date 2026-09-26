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

describe SelfPaced::CourseSummary do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:jordan) { student_in_course(course:, active_all: true, name: "Jordan Kim").user }
  let_once(:unit1) { course.context_modules.create!(name: "Unit 1") }
  let_once(:unit2) { course.context_modules.create!(name: "Unit 2") }
  let_once(:lesson_tag) { unit1.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson 1.1").id) }
  let_once(:check) do
    course.assignments.create!(title: "Check 1.1", submission_types: "online_text_entry", points_possible: 10, allowed_attempts: 5)
  end
  let_once(:check_tag) { unit1.add_item(type: "assignment", id: check.id) }
  let_once(:unit2_tag) { unit2.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson 2.1").id) }

  def state!(user, tag, attempts: 0)
    SelfPaced::StudentCourseState.create!(course:, user:, root_account: course.root_account, current_content_tag: tag, attempts_on_current_item: attempts)
  end

  def summary
    described_class.new(SelfPaced::DashboardScope.new(teacher), course).as_json
  end

  describe "#as_json" do
    it "counts who is on each unit, who is stuck there and who has finished it" do
      lesson_tag
      state!(maya, check_tag, attempts: 3)
      state!(jordan, unit2_tag)
      ContextModuleProgression.create!(context_module: unit1, user: jordan, workflow_state: "completed")

      expect(summary[:units].map { |u| u.slice(:name, :students_here, :stuck_here, :completed) }).to eql([
                                                                                                           { name: "Unit 1", students_here: 1, stuck_here: 1, completed: 1 },
                                                                                                           { name: "Unit 2", students_here: 1, stuck_here: 0, completed: 0 }
                                                                                                         ])
    end

    it "lists items that took many tries, hardest first" do
      state!(maya, check_tag)
      state!(jordan, check_tag)
      check.find_or_create_submission(maya).update_columns(attempt: 4, workflow_state: "submitted")
      check.find_or_create_submission(jordan).update_columns(attempt: 2, workflow_state: "submitted")

      expect(summary[:hard_items]).to eql([{ id: check_tag.id.to_s,
                                             title: "Check 1.1",
                                             module: "Unit 1",
                                             students_tried: 2,
                                             average_tries: 3.0,
                                             needed_many_tries: 1,
                                             students_on_it: 2 }])
    end

    it "leaves out items everyone passed on the first try" do
      state!(maya, check_tag)
      check.find_or_create_submission(maya).update_columns(attempt: 1, workflow_state: "submitted")

      expect(summary[:hard_items]).to eql([])
    end

    it "lists every item for bulk actions, with whether it's graded" do
      lesson_tag
      check_tag
      unit2_tag

      expect(summary[:items].map { |i| i.slice(:title, :graded, :attempts_limited) }).to eql([
                                                                                               { title: "Lesson 1.1", graded: false, attempts_limited: false },
                                                                                               { title: "Check 1.1", graded: true, attempts_limited: true },
                                                                                               { title: "Lesson 2.1", graded: false, attempts_limited: false }
                                                                                             ])
    end

    it "has no class chart when the course isn't paced" do
      expect(summary[:chart]).to be_nil
    end
  end

  describe "class chart" do
    before do
      course.root_account.enable_feature!(:self_paced)
      course.enable_feature!(:self_paced_pacing)
      [maya, jordan].each { |user| state!(user, lesson_tag) }
    end

    def plan!(user, baseline:, history:)
      SelfPaced::PacingPlan.create!(course:,
                                    user:,
                                    start_date: Date.new(2026, 9, 1),
                                    target_date: Date.new(2027, 6, 1),
                                    baseline: { "days" => baseline, "total_minutes" => 600 },
                                    history:)
    end

    it "averages the students' plans and progress, day by day" do
      plan!(maya, baseline: [["2026-09-01", 0.1], ["2026-09-02", 0.2]], history: { "2026-09-01" => 10.0, "2026-09-02" => 30.0 })
      # Jordan starts a day later, so on the first day they're planned at 0%
      # and have no progress to count
      plan!(jordan, baseline: [["2026-09-02", 0.4]], history: { "2026-09-02" => 20.0 })
      chart = summary[:chart]

      expect(chart[:baseline]).to eql([["2026-09-01", 5.0], ["2026-09-02", 30.0]])
      expect(chart[:actual]).to eql([["2026-09-01", 10.0], ["2026-09-02", 25.0]])
    end
  end
end
