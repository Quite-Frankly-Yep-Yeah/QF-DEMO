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

describe "self-paced permissions" do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:ta) { ta_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }

  let(:view_permissions) { %i[self_paced_view_dashboard self_paced_view_live_monitor self_paced_manage_notes] }
  let(:manage_permissions) do
    %i[
      self_paced_unlock_items
      self_paced_manage_attempts
      self_paced_adjust_pacing
      self_paced_manage_alert_rules
      self_paced_view_reports
    ]
  end
  let(:all_permissions) { view_permissions + manage_permissions }

  def granted(user, permissions)
    permissions.select { |permission| course.grants_right?(user, permission) }
  end

  it "registers every self-paced permission" do
    expect(Permissions.retrieve.keys).to include(*all_permissions)
  end

  context "when the self_paced flag is off" do
    it "grants none of them, even to teachers" do
      expect(granted(teacher, all_permissions)).to be_empty
    end
  end

  context "when the self_paced flag is on" do
    before { course.root_account.enable_feature!(:self_paced) }

    it "grants every permission to teachers" do
      expect(granted(teacher, all_permissions)).to eql(all_permissions)
    end

    it "grants TAs the view and notes permissions only" do
      expect(granted(ta, all_permissions)).to eql(view_permissions)
    end

    it "grants students nothing" do
      expect(granted(student, all_permissions)).to be_empty
    end
  end
end
