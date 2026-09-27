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

describe Supports::StudentsController do
  let_once(:root_account) { Account.default }
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:plan) { Supports::Plan.create!(account: root_account, student:, plan_type: "iep") }

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
    Supports::Catalog.ensure_defaults!(root_account)
    plan.accommodations.create!(accommodation_type: Supports::AccommodationType.find_by(kind: "extended_time"),
                                parameters: { minutes: 30 })
  end

  describe "GET 'accommodations'" do
    it "shows the student's teacher the accommodations" do
      user_session(teacher)
      get "accommodations", params: { student_id: student.id }, format: :json
      expect(response).to be_successful
      expect(json_parse(response.body)["accommodations"].first["details"]).to eql "30 extra minutes on timed quizzes"
    end

    it "refuses the student" do
      user_session(student)
      get "accommodations", params: { student_id: student.id }, format: :json
      expect(response).not_to be_successful
    end

    it "refuses everyone while the plans flag is off" do
      root_account.disable_feature!(:supports_plans)
      user_session(teacher)
      get "accommodations", params: { student_id: student.id }, format: :json
      expect(response).not_to be_successful
    end
  end

  describe "GET 'show'" do
    it "refuses a teacher, who can't see plan details" do
      user_session(teacher)
      get "show", params: { student_id: student.id }, format: :json
      expect(response).not_to be_successful
    end

    it "shows an account admin the plan" do
      user_session(account_admin_user(account: root_account))
      get "show", params: { student_id: student.id }, format: :json
      expect(json_parse(response.body)["plans"].first["plan_type"]).to eql "iep"
    end
  end

  describe "POST 'acknowledge'" do
    it "records the teacher's acknowledgement" do
      user_session(teacher)
      post "acknowledge", params: { student_id: student.id }, format: :json
      expect(json_parse(response.body)["acknowledged"]).to be true
    end
  end
end
