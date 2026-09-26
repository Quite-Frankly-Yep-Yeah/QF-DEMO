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

# Self-paced Phase 6 (docs/fork-plan.md §3.3): alert rules and the alerts they
# raise. ("alerts" is already Canvas's own table, hence the prefix.)
class CreateSelfPacedAlertTables < ActiveRecord::Migration[8.0]
  tag :predeploy

  KINDS = "'behind', 'stuck', 'max_attempts', 'inactive', 'low_grade'"

  def change
    # A rule with no course is the school's default for every course; a rule
    # for a course replaces the default for that kind in that course.
    create_table :self_paced_alert_rules do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :course, foreign_key: true, index: false
      t.string :kind, null: false, limit: 255
      # days, tries or percent, depending on the kind
      t.integer :threshold
      t.boolean :enabled, null: false, default: true
      t.boolean :notify, null: false, default: true
      t.timestamps

      t.check_constraint "kind IN (#{KINDS})", name: "chk_self_paced_alert_rules_kind"
      t.index %i[root_account_id kind],
              unique: true,
              where: "course_id IS NULL",
              name: "index_self_paced_alert_rules_default"
      t.index %i[course_id kind],
              unique: true,
              where: "course_id IS NOT NULL",
              name: "index_self_paced_alert_rules_course"
      t.replica_identity_index
    end

    # One row per student, course and kind while the trouble lasts. It stays
    # 'open' until the evaluator sees the trouble is over (or staff dismiss it).
    create_table :self_paced_alerts do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :course, null: false, foreign_key: true, index: false
      t.references :student, null: false, foreign_key: { to_table: :users }, index: false
      t.references :content_tag, foreign_key: true, index: false
      t.string :kind, null: false, limit: 255
      t.string :workflow_state, null: false, default: "open", limit: 255
      t.jsonb :detail, null: false, default: {}
      t.datetime :opened_at, null: false
      t.datetime :notified_at
      t.datetime :resolved_at
      t.references :dismissed_by, foreign_key: { to_table: :users }, index: false
      t.timestamps

      t.check_constraint "kind IN (#{KINDS})", name: "chk_self_paced_alerts_kind"
      t.check_constraint "workflow_state IN ('open', 'resolved', 'dismissed')",
                         name: "chk_self_paced_alerts_state"
      t.index %i[course_id student_id kind],
              unique: true,
              where: "workflow_state = 'open'",
              name: "index_self_paced_alerts_open"
      t.index %i[course_id workflow_state]
      t.index :student_id
      t.replica_identity_index
    end
  end
end
