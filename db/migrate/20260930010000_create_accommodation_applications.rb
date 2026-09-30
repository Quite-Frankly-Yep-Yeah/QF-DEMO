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

# Student supports Phase 2 (docs/teacher-workflow-plan.md): an append-only
# record of each time the app acted on an accommodation (extra quiz time,
# extra attempts, a pacing change, a display setting).
class CreateAccommodationApplications < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :accommodation_applications do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :student, null: false, foreign_key: { to_table: :users }, index: false
      t.references :student_accommodation, foreign_key: true, index: false
      t.references :course, foreign_key: true, index: false
      t.string :kind, null: false, limit: 255
      # what was changed: a quiz submission, a pacing plan or the student
      t.string :context_type, null: false, limit: 255
      t.bigint :context_id, null: false
      # before and after values; no free text
      t.jsonb :details, null: false, default: {}
      t.datetime :created_at, null: false

      t.index %i[student_id created_at]
      t.index :student_accommodation_id
      t.index %i[context_type context_id]
      t.replica_identity_index
    end
  end
end
