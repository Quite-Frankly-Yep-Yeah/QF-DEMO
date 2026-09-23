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

describe SelfPaced::DashboardApiController do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:outsider_course) { course_factory(active_all: true) }
  let_once(:outsider) { student_in_course(course: outsider_course, active_all: true).user }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.root_account.enable_feature!(:self_paced_activity_tracking)
    course.root_account.enable_feature!(:self_paced_teacher_dashboard)
    SelfPaced::StudentCourseState.create!(course:, user: student, root_account: course.root_account, percent_complete: 40)
  end

  describe "GET roster" do
    it "returns a row per tracked student for a teacher" do
      user_session(teacher)
      get :roster, format: :json

      expect(response.parsed_body["rows"].map { |r| [r.dig("student", "name"), r["percent_complete"]] }).to eql([["Maya Lopez", 40.0]])
    end

    it "returns nothing to a student" do
      user_session(student)
      get :roster, format: :json

      expect(response.parsed_body["rows"]).to eql([])
    end
  end

  describe "GET student" do
    it "returns the drill-down for a student in the teacher's course" do
      user_session(teacher)
      get :student, params: { course_id: course.id, student_id: student.id }, format: :json

      expect(response.parsed_body.dig("student", "name")).to eql("Maya Lopez")
    end

    it "refuses a course the viewer can't see" do
      user_session(teacher)
      get :student, params: { course_id: outsider_course.id, student_id: outsider.id }, format: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "says not found for someone who isn't a student in the course" do
      user_session(teacher)
      get :student, params: { course_id: course.id, student_id: outsider.id }, format: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PUT pin and DELETE unpin" do
    it "adds a student to the teacher's caseload and takes them off again" do
      user_session(teacher)
      put :pin, params: { student_id: student.id }, format: :json
      expect(SelfPaced::MentorCaseload.mentors_for(student, course.root_account).to_a).to eql([teacher])

      delete :unpin, params: { student_id: student.id }, format: :json
      expect(SelfPaced::MentorCaseload.mentors_for(student, course.root_account)).to be_empty
    end

    it "won't pin a student the viewer can't see" do
      user_session(teacher)
      put :pin, params: { student_id: outsider.id }, format: :json

      expect(response).to have_http_status(:forbidden)
      expect(SelfPaced::MentorCaseload.where(student: outsider)).not_to exist
    end
  end
end
