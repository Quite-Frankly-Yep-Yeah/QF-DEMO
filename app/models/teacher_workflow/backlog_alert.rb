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

module TeacherWorkflow
  # A course whose grading backlog has passed the school's limit. One is open
  # at a time per course; BacklogEvaluator resolves it when the backlog clears.
  class BacklogAlert < ApplicationRecord
    self.table_name = "workflow_backlog_alerts"

    belongs_to :root_account, class_name: "Account"
    belongs_to :course

    scope :currently_open, -> { where(workflow_state: "open") }

    before_validation { self.root_account_id ||= course&.root_account_id }

    # Notification templates read the context.
    def context
      course
    end

    def resolve!(now = Time.zone.now)
      update!(workflow_state: "resolved", resolved_at: now)
    end
  end
end
