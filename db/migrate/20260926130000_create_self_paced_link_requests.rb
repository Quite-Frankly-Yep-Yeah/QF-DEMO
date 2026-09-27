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

# A parent who signed up from the school's flyer picks their student and asks
# the school to link them; an admin approves or declines (docs/fork-plan.md
# Phase 8).
class CreateSelfPacedLinkRequests < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :self_paced_link_requests do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :observer, null: false, foreign_key: { to_table: :users }, index: false
      t.references :student, null: false, foreign_key: { to_table: :users }, index: false
      t.references :decided_by, foreign_key: { to_table: :users }, index: false
      # what the parent told the school, and what the school told the parent
      t.text :note
      t.text :response
      t.string :workflow_state, null: false, default: "pending", limit: 255
      t.datetime :decided_at
      t.timestamps

      t.check_constraint "workflow_state IN ('pending', 'approved', 'declined', 'cancelled')",
                         name: "chk_self_paced_link_requests_state"
      t.index %i[root_account_id workflow_state created_at], name: "index_self_paced_link_requests_on_account_and_state"
      t.index %i[observer_id created_at]
      t.index :student_id
      # a parent can only have one open question about a student at a time
      t.index %i[observer_id student_id],
              unique: true,
              where: "workflow_state = 'pending'",
              name: "index_self_paced_link_requests_one_pending"
      t.replica_identity_index
    end
  end
end
