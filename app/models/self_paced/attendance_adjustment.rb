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

# A staff member's logged correction to one student's attendance on one day.
module SelfPaced
  class AttendanceAdjustment < ApplicationRecord
    self.table_name = "attendance_adjustments"

    belongs_to :root_account, class_name: "Account"
    belongs_to :course
    belongs_to :student, class_name: "User"
    belongs_to :created_by, class_name: "User"

    validates :reason, presence: true
    validates :minutes, numericality: { only_integer: true, in: 0..1440 }

    before_validation { self.root_account_id ||= course&.root_account_id }

    def as_json_for_api
      {
        id: id.to_s,
        student_id: student_id.to_s,
        day: day.iso8601,
        present:,
        minutes:,
        reason:,
        created_by: created_by.name
      }
    end
  end
end
