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

# Self-paced Phase 1 (docs/fork-plan.md §2.7, §3.3): the activity ledger and
# the dashboard read model.
class CreateSelfPacedActivityTables < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    # One row per student, course and school day: the facts attendance
    # policies are evaluated against.
    create_table :activity_days do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.references :course, null: false, foreign_key: true, index: false
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.date :day, null: false
      t.integer :active_seconds, null: false, default: 0
      t.integer :submissions_count, null: false, default: 0
      t.bigint :content_tag_ids, array: true, null: false, default: []
      t.timestamp :first_activity_at
      t.timestamp :last_activity_at
      t.timestamps

      t.check_constraint "active_seconds BETWEEN 0 AND 86400", name: "chk_activity_days_active_seconds"
      t.index %i[user_id course_id day], unique: true
      t.index %i[course_id day]
      t.replica_identity_index
    end

    # Running active time per student and module item.
    create_table :item_times do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.references :course, null: false, foreign_key: true, index: false
      t.references :content_tag, null: false, foreign_key: true, index: false
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.integer :active_seconds, null: false, default: 0
      t.timestamp :first_viewed_at
      t.timestamp :last_viewed_at
      t.timestamps

      t.index %i[user_id content_tag_id], unique: true
      t.index %i[course_id user_id]
      t.replica_identity_index
    end

    # The teacher dashboard's read model: one row per student and course.
    create_table :student_course_states do |t|
      t.references :user, null: false, foreign_key: true, index: true
      t.references :course, null: false, foreign_key: true, index: false
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false

      # progress (refreshed in the background from module progress and scores)
      t.references :current_content_tag, foreign_key: { to_table: :content_tags }, index: false
      t.integer :attempts_on_current_item, null: false, default: 0
      t.integer :requirements_completed, null: false, default: 0
      t.integer :requirements_total, null: false, default: 0
      t.float :percent_complete, null: false, default: 0
      t.float :current_score
      t.float :unposted_current_score
      t.integer :days_behind # filled in by pacing (Phase 4)
      t.timestamp :refreshed_at

      # presence (written by activity pings)
      t.references :viewing_content_tag, foreign_key: { to_table: :content_tags }, index: false
      t.timestamp :viewing_since
      t.timestamp :last_seen_at
      t.timestamp :last_active_at
      t.timestamps

      t.index %i[course_id user_id], unique: true
      t.replica_identity_index
    end
  end
end
