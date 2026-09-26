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

# Self-paced Phase 5 (docs/fork-plan.md §2.5, §3.3): the append-only log of
# staff interventions and staff-only notes about students.
class CreateSelfPacedInterventionTables < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    # One row per thing staff did for a student. Rows are never changed, so
    # there is no updated_at.
    create_table :interventions do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :course, null: false, foreign_key: true, index: false
      t.references :student, null: false, foreign_key: { to_table: :users }, index: false
      t.references :actor, null: false, foreign_key: { to_table: :users }, index: false
      # who was really at the keyboard when the actor was being masqueraded
      t.references :real_actor, foreign_key: { to_table: :users }, index: false
      t.references :content_tag, foreign_key: true, index: false
      # the Progress of a bulk action that made this row
      t.references :progress, foreign_key: true, index: false
      t.string :kind, null: false, limit: 255
      t.text :reason
      t.jsonb :payload, null: false, default: {}
      t.datetime :created_at, null: false

      t.check_constraint <<~SQL.squish, name: "chk_interventions_kind"
        kind IN ('unlock', 'extra_attempts', 'reset_attempt', 'exempt', 'mark_complete',
                 'undo', 'adjust_target', 'note', 'delete_note', 'message')
      SQL
      t.index %i[course_id created_at]
      t.index %i[student_id created_at]
      t.index %i[actor_id created_at]
      t.replica_identity_index
    end

    # Staff-only notes about a student. Students and observers never see them.
    create_table :student_notes do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :student, null: false, foreign_key: { to_table: :users }, index: false
      t.references :author, null: false, foreign_key: { to_table: :users }, index: false
      # the class the note was written from, if any
      t.references :course, foreign_key: true, index: false
      t.text :body, null: false
      t.string :workflow_state, null: false, default: "active", limit: 255
      t.timestamps

      t.check_constraint "workflow_state IN ('active', 'deleted')", name: "chk_student_notes_state"
      t.index %i[student_id created_at]
      t.index :author_id
      t.replica_identity_index
    end
  end
end
