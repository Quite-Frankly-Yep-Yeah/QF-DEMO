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

# A student assigned to a support person (docs/teacher-workflow-plan.md §2.2).
# Unlike the mentor pin list, only people who manage plans can assign
# students, because an assignment unlocks the student's protected records.
module Supports
  class Caseload < ApplicationRecord
    self.table_name = "support_caseloads"

    belongs_to :root_account, class_name: "Account"
    belongs_to :staff, class_name: "User"
    belongs_to :student, class_name: "User"
    belongs_to :assigned_by, class_name: "User", optional: true

    validates :student_id, uniqueness: { scope: %i[root_account_id staff_id] }

    def self.assigned?(staff, student, root_account)
      where(staff:, student:, root_account:).exists?
    end
  end
end
