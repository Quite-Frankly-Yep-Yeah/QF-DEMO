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

# The account roles for student supports (docs/teacher-workflow-plan.md §2.2).
# Both only reach the students assigned to them (Supports::Caseload); an
# admin who should see every student gets supports_view_all_students too.
#
#   school.account_users.create!(user:, role: Supports::Roles.ensure_case_manager!(root_account))
module Supports
  module Roles
    CASE_MANAGER = "Case Manager"
    SUPPORT_STAFF = "Support Staff"

    CASE_MANAGER_PERMISSIONS = %i[
      supports_view_accommodations
      supports_view_plans
      supports_manage_plans
      supports_log_services
      read_roster
      send_messages
    ].freeze

    # Counselors, psychologists and related-service providers.
    SUPPORT_STAFF_PERMISSIONS = %i[
      supports_view_accommodations
      supports_view_plans
      supports_log_services
      read_roster
    ].freeze

    def self.ensure_case_manager!(root_account)
      SelfPaced::MentorRole.ensure_role!(root_account, CASE_MANAGER, CASE_MANAGER_PERMISSIONS)
    end

    def self.ensure_support_staff!(root_account)
      SelfPaced::MentorRole.ensure_role!(root_account, SUPPORT_STAFF, SUPPORT_STAFF_PERMISSIONS)
    end
  end
end
