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

describe SelfPaced::ActivityController do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:page) { course.wiki_pages.create!(title: "Lesson") }
  let_once(:tag) { course.context_modules.create!(name: "Unit 1").add_item(type: "wiki_page", id: page.id) }

  describe "POST create" do
    def ping(seconds: 30)
      post :create, params: { course_id: course.id, seconds:, path: "/courses/#{course.id}/pages/#{page.url}" }, format: :json
    end

    def recorded_seconds
      SelfPaced::ItemTime.where(content_tag: tag).sum(:active_seconds)
    end

    context "with activity tracking on" do
      before do
        course.root_account.enable_feature!(:self_paced)
        course.account.enable_feature!(:self_paced_activity_tracking)
      end

      it "records a student's active time on the item they're viewing" do
        user_session(student)
        ping

        expect(response).to have_http_status(:no_content)
        expect(SelfPaced::ItemTime.find_by!(user: student, content_tag: tag).active_seconds).to be 30
      end

      it "queues the first progress refresh for a student it hasn't seen before" do
        user_session(student)

        expect { ping }.to change { Delayed::Job.where(tag: "SelfPaced::StateRefresher.refresh_by_ids").count }.by(1)
      end

      it "doesn't update the enrollment's last activity for an idle heartbeat" do
        user_session(student)
        ping(seconds: 0)

        expect(student.enrollments.find_by(course:).last_activity_at).to be_nil
      end

      it "ignores teachers" do
        user_session(teacher)
        ping

        expect(response).to have_http_status(:no_content)
        expect(recorded_seconds).to be 0
      end

      it "ignores the test student" do
        user_session(course.student_view_student)
        ping

        expect(recorded_seconds).to be 0
      end

      it "ignores an admin acting as the student" do
        user_session(account_admin_user(account: course.root_account))
        session[:become_user_id] = student.id
        ping

        expect(recorded_seconds).to be 0
      end
    end

    context "with activity tracking off" do
      it "records nothing" do
        user_session(student)
        ping

        expect(response).to have_http_status(:no_content)
        expect(recorded_seconds).to be 0
      end
    end

    it "requires a logged-in user" do
      ping

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
