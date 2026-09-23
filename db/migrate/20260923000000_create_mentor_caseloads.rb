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

# Self-paced Phase 2 (docs/fork-plan.md §2.6): the students a mentor has
# pinned. A mentor is the "assigned mentor" of every student in their caseload.
class CreateMentorCaseloads < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :mentor_caseloads do |t|
      t.references :mentor, null: false, foreign_key: { to_table: :users }, index: false
      t.references :student, null: false, foreign_key: { to_table: :users }, index: true
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.timestamps

      t.index %i[mentor_id root_account_id student_id], unique: true, name: "index_mentor_caseloads_unique"
      t.replica_identity_index
    end
  end
end
