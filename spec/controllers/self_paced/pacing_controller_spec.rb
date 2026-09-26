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

describe SelfPaced::PacingController do
  let_once(:school) { Account.default.sub_accounts.create!(name: "School") }
  let_once(:course) { course_factory(account: school, active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:classmate) { student_in_course(course:, active_all: true).user }
  let_once(:unit) { course.context_modules.create!(name: "Unit 1") }
  let_once(:tag) { unit.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson").id) }

  let(:json) { response.parsed_body }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.enable_feature!(:self_paced_pacing)
    unit.update!(completion_requirements: [{ id: tag.id, type: "must_view" }])
    course.update!(self_paced_target_date: "2027-06-04")
  end

  describe "GET show" do
    it "returns the student's own plan" do
      user_session(student)
      get :show, params: { course_id: course.id }, format: :json

      expect(json).to include("target_date" => "2027-06-04", "can_adjust" => false)
      expect(json.keys).to include("days_ahead", "today", "week", "items", "chart")
    end

    it "lets teachers read a student's plan and change it" do
      user_session(teacher)
      get :show, params: { course_id: course.id, student_id: student.id }, format: :json

      expect(json).to include("target_date" => "2027-06-04", "can_adjust" => true)
    end

    it "keeps students out of each other's plans" do
      user_session(classmate)
      get :show, params: { course_id: course.id, student_id: student.id }, format: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "has nothing for someone who isn't a student" do
      user_session(teacher)
      get :show, params: { course_id: course.id }, format: :json

      expect(response).to have_http_status(:not_found)
    end

    it "is off limits while pacing is off" do
      course.disable_feature!(:self_paced_pacing)
      user_session(student)
      get :show, params: { course_id: course.id }, format: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PUT update" do
    it "sets a student's target date" do
      user_session(teacher)
      put :update, params: { course_id: course.id, student_id: student.id, target_date: "2027-03-01" }, format: :json

      expect(json).to include("target_date" => "2027-03-01", "target_source" => "teacher")
      expect(SelfPaced::PacingPlan.find_by(course:, user: student).target_set_by).to eql(teacher)
    end

    it "logs the change as an intervention" do
      user_session(teacher)
      put :update, params: { course_id: course.id, student_id: student.id, target_date: "2027-03-01", reason: "Late start" }, format: :json

      intervention = SelfPaced::Intervention.last
      expect([intervention.kind, intervention.reason, intervention.payload]).to eql(
        ["adjust_target", "Late start", { "from" => "2027-06-04", "to" => "2027-03-01", "source" => "teacher" }]
      )
    end

    it "goes back to the course's date" do
      user_session(teacher)
      put :update, params: { course_id: course.id, student_id: student.id, target_date: "2027-03-01" }, format: :json
      put :update, params: { course_id: course.id, student_id: student.id, reset: true }, format: :json

      expect(json).to include("target_date" => "2027-06-04", "target_source" => "default")
    end

    it "rejects a date that isn't a date" do
      user_session(teacher)
      put :update, params: { course_id: course.id, student_id: student.id, target_date: "soon" }, format: :json

      expect(response).to have_http_status(:bad_request)
    end

    it "is for staff who can adjust pacing" do
      user_session(student)
      put :update, params: { course_id: course.id, student_id: student.id, target_date: "2027-09-01" }, format: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET calendar" do
    it "shows the school calendar and the course's target date" do
      user_session(teacher)
      get :calendar, params: { course_id: course.id }, format: :json

      expect(json).to include("weekday_minutes" => [0, 360, 360, 360, 360, 360, 0],
                              "target_date" => "2027-06-04",
                              "can_edit_calendar" => false)
    end
  end

  describe "PUT update_calendar" do
    it "sets the course's target date" do
      user_session(teacher)
      put :update_calendar, params: { course_id: course.id, target_date: "2027-05-28" }, format: :json

      expect(Course.find(course.id).self_paced_target_date).to eql("2027-05-28")
    end

    it "leaves the weekly calendar to account admins" do
      user_session(teacher)
      put :update_calendar, params: { course_id: course.id, weekday_minutes: [0, 300, 300, 300, 300, 300, 0] }, format: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "lets an account admin change the weekly calendar" do
      user_session(account_admin_user(account: school))
      put :update_calendar,
          params: { course_id: course.id, weekday_minutes: [0, 300, 300, 300, 300, 180, 0], date_minutes: { "2026-11-25" => 0 } },
          format: :json

      calendar = InstructionalCalendar.find_by(account: school)
      expect([calendar.weekday_minutes, calendar.date_minutes]).to eql([[0, 300, 300, 300, 300, 180, 0], { "2026-11-25" => 0 }])
    end
  end
end
