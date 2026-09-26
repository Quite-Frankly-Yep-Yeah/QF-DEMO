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
describe SelfPaced::AttendanceController do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:admin) { account_admin_user(account: course.root_account) }

  before do
    %i[self_paced self_paced_activity_tracking self_paced_teacher_dashboard self_paced_reports].each do |flag|
      course.root_account.enable_feature!(flag)
    end
    SelfPaced::StudentCourseState.create!(course:, user: student, root_account: course.root_account)
  end

  def adjust(**params)
    post :create_adjustment, params: { course_id: course.id, student_id: student.id, day: "2026-09-22", present: true }.merge(params), format: :json
  end

  describe "policies" do
    it "lets a school admin add a policy and staff read them" do
      user_session(admin)
      post :create_policy, params: { effective_on: "2026-09-01", min_active_minutes: 45, submission_counts: false, notes: "State rule" }, format: :json
      expect(response).to have_http_status(:created)

      user_session(teacher)
      get :policies, format: :json
      expect(response.parsed_body["policies"].first).to include("min_active_minutes" => 45, "submission_counts" => false)
    end

    it "keeps teachers from changing the policy" do
      user_session(teacher)
      post :create_policy, params: { effective_on: "2026-09-01", min_active_minutes: 45 }, format: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "rejects two policies for the same day" do
      SelfPaced::AttendancePolicy.create!(root_account: course.root_account, effective_on: "2026-09-01")
      user_session(admin)
      post :create_policy, params: { effective_on: "2026-09-01", min_active_minutes: 45 }, format: :json

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "adjustments" do
    it "logs a correction with who made it" do
      user_session(teacher)
      adjust(minutes: 60, reason: "Offline work")
      expect(response).to have_http_status(:created)

      get :adjustments, params: { course_id: course.id, student_id: student.id }, format: :json
      expect(response.parsed_body["adjustments"].first).to include("reason" => "Offline work", "minutes" => 60)
    end

    it "needs a reason" do
      user_session(teacher)
      adjust

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "only covers students in the course" do
      user_session(teacher)
      adjust(student_id: teacher.id, reason: "x")

      expect(response).to have_http_status(:not_found)
    end
  end
end
