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

# The account-level "Mentor" role (docs/fork-plan.md §2.6, decision 2): on-site
# staff who see every student in their school's self-paced courses, with
# read-only grades, but can't grade or edit course content. They can message
# students (Phase 5 interventions).
#
#   SelfPaced::MentorRole.ensure!(root_account)
#   school.account_users.create!(user: mentor, role: SelfPaced::MentorRole.ensure!(root_account))
module SelfPaced
  module MentorRole
    NAME = "Mentor"

    PERMISSIONS = %i[
      self_paced_view_dashboard
      self_paced_view_live_monitor
      self_paced_manage_notes
      self_paced_unlock_items
      self_paced_adjust_pacing
      read_roster
      view_all_grades
      send_messages
    ].freeze

    # Finds or creates the role in +root_account+ and makes sure it has the
    # mentor permissions. Safe to run again.
    def self.ensure!(root_account)
      ensure_role!(root_account, NAME, PERMISSIONS)
    end

    # Finds or creates the account role +name+ and turns +permissions+ on for
    # it. Shared with SelfPaced::CourseEditorRole.
    def self.ensure_role!(root_account, name, permissions)
      role = root_account.roles.active.find_by(name:, base_role_type: "AccountMembership") ||
             root_account.roles.create!(name:, base_role_type: "AccountMembership")

      permissions.each do |permission|
        override = root_account.role_overrides.find_or_initialize_by(role:, permission: permission.to_s)
        override.update!(enabled: true) unless override.persisted? && override.enabled
      end
      role
    end
  end
end
