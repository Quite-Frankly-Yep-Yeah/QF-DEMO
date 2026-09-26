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
describe SelfPaced::ReportsController do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:outsider_course) { course_factory(active_all: true) }
  let_once(:outsider) { student_in_course(course: outsider_course, active_all: true, name: "Elsewhere Kid").user }

  before do
    %i[self_paced self_paced_activity_tracking self_paced_teacher_dashboard self_paced_reports].each do |flag|
      course.root_account.enable_feature!(flag)
    end
    [[course, student], [outsider_course, outsider]].each do |c, s|
      SelfPaced::StudentCourseState.create!(course: c, user: s, root_account: c.root_account, percent_complete: 25)
    end
  end

  describe "GET show" do
    it "sends a CSV for the viewer's courses only" do
      user_session(teacher)
      get :show, params: { kind: "progress" }

      expect(response.media_type).to eql("text/csv")
      expect(response.headers["Content-Disposition"]).to include("self_paced_progress_")
      expect(CSV.parse(response.body, headers: true).pluck("student")).to eql(["Maya Lopez"])
    end

    it "can be narrowed to a course and a date range" do
      user_session(teacher)
      get :show, params: { kind: "time_on_task", course_id: course.id, from: "2026-09-01", to: "2026-09-30" }

      expect(response).to be_successful
    end

    it "rejects a backwards range" do
      user_session(teacher)
      get :show, params: { kind: "progress", from: "2026-10-01", to: "2026-09-01" }

      expect(response).to have_http_status(:bad_request)
    end

    it "404s an unknown report" do
      user_session(teacher)
      get :show, params: { kind: "secrets" }

      expect(response).to have_http_status(:not_found)
    end

    it "is off limits while the reports flag is off" do
      course.root_account.disable_feature!(:self_paced_reports)
      user_session(teacher)
      get :show, params: { kind: "progress" }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
