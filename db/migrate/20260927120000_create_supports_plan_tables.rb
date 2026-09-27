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

# Student supports Phase 1 (docs/teacher-workflow-plan.md): support plans, the
# school's accommodation catalog, each student's accommodations, teachers'
# acknowledgements, and CSV imports that can be undone.
class CreateSupportsPlanTables < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :support_plans do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      # the school the plan belongs to
      t.references :account, null: false, foreign_key: true, index: false
      t.references :student, null: false, foreign_key: { to_table: :users }, index: false
      t.references :case_manager, foreign_key: { to_table: :users }, index: false
      t.references :created_by, foreign_key: { to_table: :users }, index: false
      t.string :plan_type, null: false, limit: 255
      t.string :workflow_state, null: false, default: "active", limit: 255
      t.date :start_date
      # the next review date
      t.date :end_date
      # "manual" or "import"; the district's id when imported
      t.string :source, null: false, default: "manual", limit: 255
      t.string :external_id, limit: 255
      # goes up whenever the accommodations change, so teachers acknowledge again
      t.integer :version, null: false, default: 1
      # encrypted (tier 2)
      t.text :notes
      t.timestamps

      t.check_constraint "plan_type IN ('iep', '504', 'el', 'other')", name: "chk_support_plans_type"
      t.check_constraint "workflow_state IN ('active', 'archived', 'deleted')", name: "chk_support_plans_state"
      t.index %i[student_id workflow_state]
      t.index %i[account_id workflow_state]
      t.index :case_manager_id
      t.index %i[root_account_id external_id], unique: true, where: "external_id IS NOT NULL",
                                                name: "index_support_plans_on_external_id"
      t.replica_identity_index
    end

    create_table :accommodation_types do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.string :name, null: false, limit: 255
      # how the app applies it (docs/teacher-workflow-plan.md §2.3)
      t.string :kind, null: false, default: "informational", limit: 255
      # what a teacher is told to do, in plain words
      t.text :instructions
      t.jsonb :default_parameters, null: false, default: {}
      t.integer :position, null: false, default: 0
      t.string :workflow_state, null: false, default: "active", limit: 255
      t.timestamps

      t.check_constraint "workflow_state IN ('active', 'deleted')", name: "chk_accommodation_types_state"
      t.index %i[root_account_id workflow_state position], name: "index_accommodation_types_on_account"
      t.index %i[root_account_id name], unique: true, where: "workflow_state = 'active'",
                                        name: "index_accommodation_types_unique_name"
      t.replica_identity_index
    end

    create_table :student_accommodations do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :support_plan, null: false, foreign_key: true, index: false
      t.references :student, null: false, foreign_key: { to_table: :users }, index: false
      t.references :accommodation_type, null: false, foreign_key: true, index: false
      t.jsonb :parameters, null: false, default: {}
      t.date :start_date
      t.date :end_date
      # the courses it applies to; empty means all of the student's courses
      t.bigint :course_ids, array: true, null: false, default: []
      # encrypted: shown to the student's teachers (tier 1)
      t.text :teacher_note
      t.datetime :last_verified_at
      t.string :workflow_state, null: false, default: "active", limit: 255
      t.timestamps

      t.check_constraint "workflow_state IN ('active', 'deleted')", name: "chk_student_accommodations_state"
      t.index %i[support_plan_id workflow_state]
      t.index %i[student_id workflow_state]
      t.index :accommodation_type_id
      t.replica_identity_index
    end

    create_table :accommodation_acknowledgements do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :support_plan, null: false, foreign_key: true, index: false
      t.references :user, null: false, foreign_key: true, index: false
      t.integer :plan_version, null: false
      t.datetime :created_at, null: false

      t.index %i[support_plan_id plan_version user_id], unique: true, name: "index_accommodation_acks_unique"
      t.index :user_id
      t.replica_identity_index
    end

    create_table :support_imports do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :account, null: false, foreign_key: true, index: false
      t.references :user, null: false, foreign_key: true, index: false
      t.string :format, null: false, default: "generic", limit: 255
      t.string :filename, limit: 255
      t.string :workflow_state, null: false, default: "previewed", limit: 255
      # what each row would do; no notes, so not encrypted
      t.jsonb :preview, null: false, default: {}
      # encrypted: the uploaded file, and what applying it changed (for undo)
      t.text :data
      t.text :applied_changes
      t.datetime :applied_at
      t.datetime :undone_at
      t.timestamps

      t.check_constraint "workflow_state IN ('previewed', 'applied', 'undone', 'discarded')", name: "chk_support_imports_state"
      t.index %i[account_id created_at]
      t.replica_identity_index
    end
  end
end
