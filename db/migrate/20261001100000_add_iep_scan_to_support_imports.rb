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

class AddIepScanToSupportImports < ActiveRecord::Migration[8.0]
  tag :predeploy
  disable_ddl_transaction!

  # rubocop:disable Rails/BulkChangeTable -- not transactional, so each step is idempotent on its own
  def change
    add_reference :support_imports, :student, foreign_key: { to_table: :users }, index: false, if_not_exists: true
    add_reference :support_imports, :plan, foreign_key: { to_table: :support_plans }, index: false, if_not_exists: true
    add_column :support_imports, :extraction_state, :string, limit: 255, if_not_exists: true
    add_column :support_imports, :extraction_error, :string, limit: 255, if_not_exists: true
    add_column :support_imports, :content_type, :string, limit: 255, if_not_exists: true
    # encrypted: what was read from the document, as the reviewer edits it
    add_column :support_imports, :extraction, :text, if_not_exists: true

    add_check_constraint :support_imports,
                         "extraction_state IS NULL OR extraction_state IN ('queued', 'running', 'ready', 'failed')",
                         name: "chk_support_imports_extraction_state",
                         validate: false,
                         if_not_exists: true
    add_index :support_imports, :student_id, where: "student_id IS NOT NULL", algorithm: :concurrently, if_not_exists: true
    add_index :support_imports, :plan_id, where: "plan_id IS NOT NULL", algorithm: :concurrently, if_not_exists: true
  end
  # rubocop:enable Rails/BulkChangeTable
end
