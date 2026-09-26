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

# Self-paced Phase 7 (docs/fork-plan.md §2.10): attendance rules and manual
# corrections. The facts (activity_days) already exist; these only say how to
# read them, so a new state rule is a new row, not a migration.
class CreateSelfPacedAttendanceTables < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    # A versioned rule set. The one with the latest effective_on on or before a
    # day is the one that applies to that day.
    create_table :attendance_policies do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.date :effective_on, null: false
      # a day counts as attended with at least this many active minutes...
      t.integer :min_active_minutes, null: false, default: 30
      # ...or with a submission, if this is on
      t.boolean :submission_counts, null: false, default: true
      t.text :notes
      t.references :created_by, foreign_key: { to_table: :users }, index: false
      t.timestamps

      t.check_constraint "min_active_minutes BETWEEN 0 AND 1440", name: "chk_attendance_policies_minutes"
      t.index %i[root_account_id effective_on], unique: true
      t.replica_identity_index
    end

    # A logged manual correction for one student on one day, such as documented
    # offline work. The newest one for a day wins.
    create_table :attendance_adjustments do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :course, null: false, foreign_key: true, index: false
      t.references :student, null: false, foreign_key: { to_table: :users }, index: false
      t.date :day, null: false
      t.boolean :present, null: false
      # documented minutes added to the day's active time
      t.integer :minutes, null: false, default: 0
      t.text :reason, null: false
      t.references :created_by, null: false, foreign_key: { to_table: :users }, index: false
      t.timestamps

      t.check_constraint "minutes BETWEEN 0 AND 1440", name: "chk_attendance_adjustments_minutes"
      t.index %i[course_id student_id day]
      t.index :student_id
      t.replica_identity_index
    end
  end
end
