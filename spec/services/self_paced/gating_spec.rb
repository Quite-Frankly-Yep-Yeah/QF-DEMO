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

describe SelfPaced::Gating do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:context_module) { course.context_modules.create!(name: "Unit 1") }
  let_once(:page_tag) { context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson").id) }
  let_once(:check) { course.assignments.create!(title: "Check", submission_types: "online_text_entry", points_possible: 10) }
  let_once(:check_tag) { context_module.add_item(type: "assignment", id: check.id) }
  let_once(:next_page_tag) { context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Next lesson").id) }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.enable_feature!(:self_paced_course_player)
    context_module.update!(require_sequential_progress: true,
                           completion_requirements: [{ id: page_tag.id, type: "must_view" },
                                                     { id: check_tag.id, type: "min_percentage", min_percentage: 70 },
                                                     { id: next_page_tag.id, type: "must_view" }])
  end

  def met_ids
    ContextModule.find(context_module.id).evaluate_for(student).requirements_met.pluck(:id)
  end

  def open_to_student?(tag)
    ContextModule.find(context_module.id).available_for?(student, tag:, deep_check_if_needed: true)
  end

  def override!(tag, kind)
    SelfPaced::ItemOverride.create!(content_tag: tag, user: student, kind:, created_by: teacher)
    RequestCache.clear
  end

  describe "per-student overrides" do
    it "counts an exempted item as done" do
      override!(page_tag, "exempt")

      expect(met_ids).to include(page_tag.id)
    end

    it "counts an item marked complete as done" do
      override!(page_tag, "complete")

      expect(met_ids).to include(page_tag.id)
    end

    it "lets a student open an unlocked item ahead of its turn" do
      expect(open_to_student?(next_page_tag)).to be false

      override!(next_page_tag, "unlock")
      expect(open_to_student?(next_page_tag)).to be true
    end

    it "is ignored in courses without the course player" do
      course.disable_feature!(:self_paced_course_player)
      override!(page_tag, "exempt")

      expect(met_ids).not_to include(page_tag.id)
    end
  end

  describe "must_watch" do
    before do
      context_module.update!(completion_requirements: [{ id: page_tag.id, type: "must_watch" }])
    end

    it "keeps the requirement when the student only views the page" do
      page_tag.context_module_action(student, :read)

      expect(met_ids).not_to include(page_tag.id)
    end

    it "is met once the video has been watched" do
      page_tag.context_module_action(student, :watched)

      expect(met_ids).to include(page_tag.id)
    end
  end

  describe "provisional mode" do
    before do
      course.update!(self_paced_provisional_checks: true)
      page_tag.context_module_action(student, :read)
    end

    it "lets a student past a check that is waiting for a grade" do
      check.submit_homework(student, body: "my answer")
      run_jobs

      expect(met_ids).to include(check_tag.id)
    end

    it "keeps a check locked while provisional mode is off" do
      course.update!(self_paced_provisional_checks: false)
      check.submit_homework(student, body: "my answer")
      run_jobs

      expect(met_ids).not_to include(check_tag.id)
    end

    it "re-locks and tells the mentor when the grade comes in below mastery" do
      mentor = user_factory(active_all: true)
      SelfPaced::MentorCaseload.create!(mentor:, student:, root_account: course.root_account)
      notification = notification_model(name: SelfPaced::RelockNotifier::NOTIFICATION_NAME, category: "Grading")
      allow(BroadcastPolicy.notification_finder).to receive(:by_name).and_call_original
      allow(BroadcastPolicy.notification_finder).to receive(:by_name).with(SelfPaced::RelockNotifier::NOTIFICATION_NAME).and_return(notification)
      check.submit_homework(student, body: "my answer")
      run_jobs

      expect(notification).to receive(:create_message).with(check.submissions.find_by(user: student), [mentor])
      check.grade_student(student, grade: 5, grader: teacher)
      run_jobs

      expect(met_ids).not_to include(check_tag.id)
    end
  end

  describe "RelockNotifier.recipients" do
    it "falls back to the course's teachers when nobody has pinned the student" do
      # course_factory enrolls a teacher of its own, so expect every instructor
      expect(SelfPaced::RelockNotifier.recipients(student, course)).to include(teacher)
      expect(SelfPaced::RelockNotifier.recipients(student, course)).to match_array(course.participating_instructors.distinct.to_a)
    end
  end
end
