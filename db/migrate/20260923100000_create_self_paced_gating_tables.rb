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

# Self-paced Phase 3 (docs/fork-plan.md §2.1, §3.3): per-item settings for the
# course player and per-student overrides for gating.
class CreateSelfPacedGatingTables < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    # How the course player treats one module item. The setup screen turns
    # these into native module completion requirements.
    create_table :module_item_settings do |t|
      t.references :content_tag, null: false, foreign_key: true, index: { unique: true }
      t.references :course, null: false, foreign_key: true, index: true
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.string :role, null: false, default: "none", limit: 255
      t.integer :estimated_minutes
      t.float :mastery_threshold # percent; nil means the course default
      t.float :watch_fraction # set for videos that must be watched to this fraction
      t.integer :max_attempts # for checks; written to the quiz or assignment
      t.boolean :retake_review, null: false, default: false
      t.timestamps

      t.check_constraint "role IN ('instruction', 'practice', 'check', 'pretest', 'none')", name: "chk_module_item_settings_role"
      t.replica_identity_index
    end

    # Per-student exceptions to gating: unlock an item early, or treat it as
    # exempt or complete. Written by staff interventions.
    create_table :module_item_student_overrides do |t|
      t.references :content_tag, null: false, foreign_key: true, index: false
      t.references :user, null: false, foreign_key: true, index: false
      t.references :course, null: false, foreign_key: true, index: false
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :created_by, foreign_key: { to_table: :users }, index: false
      t.string :kind, null: false, limit: 255
      t.text :reason
      t.string :workflow_state, null: false, default: "active", limit: 255
      t.timestamps

      t.check_constraint "kind IN ('unlock', 'exempt', 'complete')", name: "chk_module_item_student_overrides_kind"
      t.check_constraint "workflow_state IN ('active', 'deleted')", name: "chk_module_item_student_overrides_state"
      t.index %i[content_tag_id user_id kind], unique: true, where: "workflow_state = 'active'", name: "index_active_module_item_student_overrides"
      t.index %i[course_id user_id]
      t.replica_identity_index
    end
  end
end
