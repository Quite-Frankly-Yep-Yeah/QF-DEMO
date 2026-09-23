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

# A student pinned to a staff member's caseload (docs/fork-plan.md §2.6).
# Anyone who can see the dashboard can pin students; for mentors, the caseload
# also decides who gets "assigned mentor" notifications.
module SelfPaced
  class MentorCaseload < ApplicationRecord
    self.table_name = "mentor_caseloads"

    belongs_to :mentor, class_name: "User"
    belongs_to :student, class_name: "User"
    belongs_to :root_account, class_name: "Account"

    # The staff whose caseload includes +student+ in +root_account+.
    def self.mentors_for(student, root_account)
      User.where(id: where(student:, root_account:).select(:mentor_id))
    end
  end
end
