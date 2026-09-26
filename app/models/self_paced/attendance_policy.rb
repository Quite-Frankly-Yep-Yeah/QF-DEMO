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

# A versioned attendance rule set for a school (docs/fork-plan.md §2.10).
module SelfPaced
  class AttendancePolicy < ApplicationRecord
    self.table_name = "attendance_policies"

    # What applies when the school hasn't set a policy.
    DEFAULT = { min_active_minutes: 30, submission_counts: true }.freeze

    belongs_to :root_account, class_name: "Account"
    belongs_to :created_by, class_name: "User", optional: true

    validates :effective_on, presence: true, uniqueness: { scope: :root_account_id }
    validates :min_active_minutes, numericality: { only_integer: true, in: 0..1440 }

    # The policy in force on +day+, or nil when the school has none yet.
    def self.in_force(root_account, day)
      where(root_account:).where(effective_on: ..day).order(effective_on: :desc).first
    end

    def as_json_for_api
      { id: id.to_s, effective_on: effective_on.iso8601, min_active_minutes:, submission_counts:, notes: }
    end
  end
end
