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

describe Course do
  describe "#tabs_available with the self-paced dashboard" do
    let_once(:course) { course_factory(active_all: true) }
    let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
    let_once(:student) { student_in_course(course:, active_all: true).user }

    def tab_ids(user)
      course.tabs_available(user).pluck(:id)
    end

    it "gives teachers a Student Dashboard tab once the dashboard is on" do
      course.root_account.enable_feature!(:self_paced)
      course.root_account.enable_feature!(:self_paced_teacher_dashboard)

      expect(tab_ids(teacher)).to include(Course::TAB_SELF_PACED_DASHBOARD)
    end

    it "never gives students the tab" do
      course.root_account.enable_feature!(:self_paced)
      course.root_account.enable_feature!(:self_paced_teacher_dashboard)

      expect(tab_ids(student)).not_to include(Course::TAB_SELF_PACED_DASHBOARD)
    end

    it "leaves the tab out while the dashboard is off" do
      expect(tab_ids(teacher)).not_to include(Course::TAB_SELF_PACED_DASHBOARD)
    end
  end
end
