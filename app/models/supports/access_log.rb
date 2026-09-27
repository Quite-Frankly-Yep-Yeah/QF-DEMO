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

# Who opened a student's protected support records, and when
# (docs/teacher-workflow-plan.md §2.2). Append-only: rows are only ever
# removed when the student's user is deleted. Repeat views by the same person
# of the same record inside one hour share a row.
module Supports
  class AccessLog < ApplicationRecord
    self.table_name = "support_access_logs"

    belongs_to :root_account, class_name: "Account"
    belongs_to :viewer, class_name: "User"
    belongs_to :real_user, class_name: "User", optional: true
    belongs_to :student, class_name: "User"

    validates :tier, inclusion: { in: Supports::TIERS.values }
    validates :subject, presence: true

    def readonly?
      persisted?
    end

    # Writes one row for this view unless the same view is already logged for
    # the current hour.
    def self.record!(viewer:, student:, tier:, subject:, root_account:, real_user: nil)
      now = Time.now.utc
      insert_all([{
                   root_account_id: root_account.id,
                   viewer_id: viewer.id,
                   real_user_id: (real_user.id if real_user && real_user != viewer),
                   student_id: student.id,
                   tier:,
                   subject: subject.to_s,
                   viewed_hour: now.beginning_of_hour,
                   created_at: now
                 }])
    end
  end
end
