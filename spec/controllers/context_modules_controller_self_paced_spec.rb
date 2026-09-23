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

describe ContextModulesController do
  describe "GET index with the course player" do
    let_once(:course) { course_factory(active_all: true) }
    let_once(:student) { student_in_course(course:, active_all: true).user }

    it "sends students to the course map instead of the modules page" do
      course.root_account.enable_feature!(:self_paced)
      course.enable_feature!(:self_paced_course_player)
      user_session(student)
      get :index, params: { course_id: course.id }

      expect(response).to redirect_to("/courses/#{course.id}/player")
    end

    it "leaves the modules page alone while the course player is off" do
      user_session(student)
      get :index, params: { course_id: course.id }

      expect(response.location.to_s).not_to include("/player")
    end
  end
end
