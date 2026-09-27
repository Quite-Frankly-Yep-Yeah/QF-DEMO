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

# Student supports foundations (docs/teacher-workflow-plan.md Phase 0): the
# students assigned to each support person, and an append-only log of who
# opened a student's protected records.
class CreateSupportsFoundationTables < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :support_caseloads do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :staff, null: false, foreign_key: { to_table: :users }, index: false
      t.references :student, null: false, foreign_key: { to_table: :users }, index: false
      t.references :assigned_by, foreign_key: { to_table: :users }, index: false
      t.timestamps

      t.index %i[root_account_id staff_id student_id], unique: true, name: "index_support_caseloads_unique"
      t.index :student_id
      t.index :staff_id
      t.replica_identity_index
    end

    create_table :support_access_logs do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :viewer, null: false, foreign_key: { to_table: :users }, index: false
      # set when the viewer was masquerading
      t.references :real_user, foreign_key: { to_table: :users }, index: false
      t.references :student, null: false, foreign_key: { to_table: :users }, index: false
      t.integer :tier, null: false, limit: 2
      # what was opened, for example "accommodations"
      t.string :subject, null: false, limit: 255
      # the hour the view happened in; repeat views inside it share one row
      t.datetime :viewed_hour, null: false
      t.datetime :created_at, null: false

      t.check_constraint "tier BETWEEN 1 AND 3", name: "chk_support_access_logs_tier"
      t.index "viewer_id, student_id, tier, subject, viewed_hour, COALESCE(real_user_id, 0)",
              unique: true,
              name: "index_support_access_logs_one_per_hour"
      t.index %i[student_id created_at]
      t.replica_identity_index
    end
  end
end
