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

describe SelfPaced::ModelHooks do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:assignment) { course.assignments.create!(title: "Check", submission_types: "online_text_entry", points_possible: 10) }

  def queued_refreshes
    Delayed::Job.where(tag: "SelfPaced::StateRefresher.refresh_by_ids")
  end

  context "with activity tracking on" do
    before do
      course.root_account.enable_feature!(:self_paced)
      course.account.enable_feature!(:self_paced_activity_tracking)
    end

    it "counts a submission toward the student's day and queues a refresh" do
      expect { assignment.submit_homework(student, body: "done") }.to change { queued_refreshes.count }.by(1)
      expect(SelfPaced::ActivityDay.find_by!(user: student, course:).submissions_count).to be 1
    end

    it "queues a refresh when module progress changes" do
      context_module = course.context_modules.create!(name: "Unit 1")
      tag = context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson").id)
      context_module.update!(completion_requirements: [{ id: tag.id, type: "must_view" }])

      expect { tag.context_module_action(student, :read) }.to change { queued_refreshes.count }.by(1)
    end

    it "queues a refresh when the student's course score changes" do
      score = student.enrollments.find_by(course:).find_score

      expect { score.update!(current_score: 72.0) }.to change { queued_refreshes.count }.by(1)
    end

    it "ignores the test student" do
      test_student = course.student_view_student

      expect { assignment.submit_homework(test_student, body: "done") }.not_to change { queued_refreshes.count }
      expect(SelfPaced::ActivityDay.where(user: test_student)).not_to exist
    end
  end

  context "with self-paced off" do
    it "records nothing and queues nothing" do
      expect { assignment.submit_homework(student, body: "done") }.not_to change { queued_refreshes.count }
      expect(SelfPaced::ActivityDay.where(user: student)).not_to exist
    end
  end
end
