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

describe CoursesController do
  describe "GET show with self-paced activity tracking" do
    let_once(:course) { course_factory(active_all: true) }
    let_once(:student) { student_in_course(course:, active_all: true).user }
    let_once(:teacher) { teacher_in_course(course:, active_all: true).user }

    def pinger_config
      controller.js_env[:SELF_PACED_ACTIVITY]
    end

    context "with activity tracking on" do
      before do
        course.root_account.enable_feature!(:self_paced)
        course.account.enable_feature!(:self_paced_activity_tracking)
      end

      it "tells a student's browser where to send activity pings" do
        user_session(student)
        get :show, params: { id: course.id, module_item_id: "12" }

        expect(pinger_config).to eql({ ping_url: "/api/v1/courses/#{course.id}/self_paced/activity", module_item_id: "12" })
      end

      it "leaves the pinger off for teachers" do
        user_session(teacher)
        get :show, params: { id: course.id }

        expect(pinger_config).to be_nil
      end
    end

    it "leaves the pinger off while activity tracking is off" do
      user_session(student)
      get :show, params: { id: course.id }

      expect(pinger_config).to be_nil
    end
  end
end
