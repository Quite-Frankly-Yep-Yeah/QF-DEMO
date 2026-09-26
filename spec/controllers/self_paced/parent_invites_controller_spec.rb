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

describe SelfPaced::ParentInvitesController do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:outsider_course) { course_factory(active_all: true) }
  let_once(:outsider) { student_in_course(course: outsider_course, active_all: true).user }

  before do
    %i[self_paced self_paced_activity_tracking self_paced_teacher_dashboard self_paced_observer_view].each do |flag|
      course.root_account.enable_feature!(flag)
    end
  end

  describe "POST create" do
    it "makes a code for a student the teacher can see, on the address the teacher is using" do
      user_session(teacher)
      post :create, params: { student_id: maya.id }, format: :json

      expect(response).to be_successful
      json = response.parsed_body
      expect(json["url"]).to eql("http://test.host/parents/join/#{json["code"]}")
      expect(json["qr_svg"]).to start_with("<svg")
    end

    it "keeps a teacher from another school's students" do
      user_session(teacher)
      post :create, params: { student_id: outsider.id }, format: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "lets an admin who manages students make one for anyone" do
      user_session(account_admin_user(account: course.root_account))
      post :create, params: { student_id: outsider.id }, format: :json

      expect(response).to be_successful
    end

    it "keeps students out" do
      user_session(maya)
      post :create, params: { student_id: maya.id }, format: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "only works for students" do
      user_session(teacher)
      post :create, params: { student_id: teacher.id }, format: :json

      expect(response).to have_http_status(:not_found)
    end

    it "is off while the observer view is off" do
      course.root_account.disable_feature!(:self_paced_observer_view)
      user_session(teacher)
      post :create, params: { student_id: maya.id }, format: :json

      expect(response).to have_http_status(:forbidden)
    end
  end
end
