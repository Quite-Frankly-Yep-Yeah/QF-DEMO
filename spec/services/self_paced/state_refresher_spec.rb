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

describe SelfPaced::StateRefresher do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:context_module) { course.context_modules.create!(name: "Unit 1") }
  let_once(:page_tag) { context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson").id) }
  let_once(:assignment) { course.assignments.create!(title: "Check", submission_types: "online_text_entry", points_possible: 10) }
  let_once(:assignment_tag) { context_module.add_item(type: "assignment", id: assignment.id) }

  let(:state) { SelfPaced::StudentCourseState.find_by(user: student, course:) }

  before do
    context_module.update!(require_sequential_progress: true,
                           completion_requirements: [{ id: page_tag.id, type: "must_view" },
                                                     { id: assignment_tag.id, type: "must_submit" }])
  end

  def enable_tracking
    course.root_account.enable_feature!(:self_paced)
    course.account.enable_feature!(:self_paced_activity_tracking)
  end

  describe ".refresh" do
    it "records module progress and the item the student is on" do
      page_tag.context_module_action(student, :read)
      described_class.refresh(course, student)

      expect(state).to have_attributes(current_content_tag_id: assignment_tag.id,
                                       requirements_completed: 1,
                                       requirements_total: 2,
                                       percent_complete: 50.0)
    end

    it "counts the attempts made on the current item" do
      page_tag.context_module_action(student, :read)
      assignment.submit_homework(student, body: "first try")
      assignment.submit_homework(student, body: "second try")
      context_module.update!(completion_requirements: [{ id: page_tag.id, type: "must_view" },
                                                       { id: assignment_tag.id, type: "min_score", min_score: 7 }])
      described_class.refresh(course, student)

      expect(state).to have_attributes(current_content_tag_id: assignment_tag.id, attempts_on_current_item: 2)
    end

    it "records the posted and unposted course score" do
      student.enrollments.find_by(course:).find_score.update!(current_score: 80.0, unposted_current_score: 85.0)
      described_class.refresh(course, student)

      expect(state).to have_attributes(current_score: 80.0, unposted_current_score: 85.0)
    end

    it "keeps the presence columns written by activity pings" do
      SelfPaced::ActivityLedger.record_ping(user: student, course:, seconds: 30, content_tag: page_tag)
      described_class.refresh(course, student)

      expect(state).to have_attributes(viewing_content_tag_id: page_tag.id, last_active_at: be_present, refreshed_at: be_present)
    end

    it "removes the row once the student is no longer enrolled" do
      described_class.refresh(course, student)
      student.enrollments.find_by(course:).destroy
      described_class.refresh(course, student)

      expect(state).to be_nil
    end
  end

  describe ".enqueue" do
    def enqueue
      described_class.enqueue(root_account_id: course.root_account_id, course_id: course.id, user_id: student.id)
    end

    def queued_jobs
      Delayed::Job.where(tag: "SelfPaced::StateRefresher.refresh_by_ids")
    end

    it "does nothing while self-paced is off" do
      expect { enqueue }.not_to change { queued_jobs.count }
    end

    it "does nothing while activity tracking is off" do
      course.root_account.enable_feature!(:self_paced)

      expect { enqueue }.not_to change { queued_jobs.count }
    end

    it "queues one delayed refresh per student and course, however often it's called" do
      enable_tracking

      expect { 3.times { enqueue } }.to change { queued_jobs.count }.by(1)
      expect(queued_jobs.last.run_at).to be > Time.zone.now
    end
  end

  describe ".rebuild_course" do
    it "refreshes every active student and drops students who left" do
      enable_tracking
      leaver = student_in_course(course:, active_all: true).user
      described_class.rebuild_course(course)
      student.enrollments.find_by(course:).destroy
      described_class.rebuild_course(course)

      expect(SelfPaced::StudentCourseState.where(course:).pluck(:user_id)).to eql([leaver.id])
    end

    it "does nothing while activity tracking is off" do
      described_class.rebuild_course(course)

      expect(SelfPaced::StudentCourseState.where(course:)).not_to exist
    end
  end
end
