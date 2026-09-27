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

# Self-paced Phase 4 (docs/fork-plan.md §2.3, §3.3): school calendars and
# per-student pacing plans.
class CreateSelfPacedPacingTables < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    # Which weekdays a school teaches and for how long. Days with 0 minutes
    # have no instruction; specific dates (half days) can override the weekday.
    # Days with no school at all stay in blackout_dates.
    create_table :instructional_calendars do |t|
      t.references :account, null: false, foreign_key: true, index: { unique: true }
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.integer :weekday_minutes, array: true, null: false, default: [0, 360, 360, 360, 360, 360, 0] # Sunday first
      t.jsonb :date_minutes, null: false, default: {} # {"2026-11-25" => 180}
      t.timestamps

      t.check_constraint "array_length(weekday_minutes, 1) = 7", name: "chk_instructional_calendars_weekdays"
      t.replica_identity_index
    end

    # One plan per student and course. The baseline is fixed when the plan is
    # made (or its start or target date is changed) and is only used to report
    # pace; the current plan re-spreads the remaining work from today.
    create_table :pacing_plans do |t|
      t.references :user, null: false, foreign_key: true, index: true
      t.references :course, null: false, foreign_key: true, index: false
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.date :start_date, null: false
      t.date :target_date, null: false
      t.string :target_source, null: false, default: "default", limit: 255
      t.references :target_set_by, foreign_key: { to_table: :users }, index: false
      t.jsonb :baseline, null: false, default: {}
      t.jsonb :current, null: false, default: {}
      t.date :planned_on # the day the current plan was last spread
      t.jsonb :written_due_dates, null: false, default: {} # {assignment_id => due_at we wrote}
      t.jsonb :history, null: false, default: {} # {date => percent of work complete}
      t.integer :version, null: false, default: 1
      t.timestamps

      t.check_constraint "target_source IN ('default', 'teacher')", name: "chk_pacing_plans_target_source"
      t.index %i[course_id user_id], unique: true
      t.replica_identity_index
    end

    change_table :student_course_states, bulk: true do |t|
      t.date :target_date
      t.float :expected_percent
    end
  end
end
