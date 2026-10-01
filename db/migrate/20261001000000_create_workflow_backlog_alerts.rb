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

# Teacher workflow Phase 3 (docs/superpowers/specs/2026-10-01-grading-queue-design.md):
# one open row per course while its grading backlog is past the school's limit.
class CreateWorkflowBacklogAlerts < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :workflow_backlog_alerts do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :course, null: false, foreign_key: true, index: false
      t.string :workflow_state, null: false, default: "open", limit: 255
      t.datetime :oldest_waiting_at, null: false
      t.integer :school_days_waiting, null: false
      t.datetime :opened_at, null: false
      t.datetime :notified_at
      t.datetime :resolved_at
      t.timestamps

      t.check_constraint "workflow_state IN ('open', 'resolved')", name: "chk_workflow_backlog_alerts_state"
      t.index :course_id, unique: true, where: "workflow_state = 'open'", name: "index_workflow_backlog_alerts_open"
      t.index %i[course_id workflow_state]
      t.replica_identity_index
    end
  end
end
