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

# Student supports: an IEP bulk upload (docs/superpowers/specs/2026-10-02-iep-bulk-scan-design.md).
# A batch is the set of scans uploaded together. It holds no student data;
# each scan (a support_imports row) points at it, and has no student until a
# person confirms one.
class CreateSupportScanBatches < ActiveRecord::Migration[8.0]
  tag :predeploy
  disable_ddl_transaction!

  def change
    create_table :support_scan_batches, if_not_exists: true do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :account, null: false, foreign_key: true, index: false
      t.references :user, null: false, foreign_key: true, index: false
      t.timestamps

      t.index :user_id, if_not_exists: true
      t.index :account_id, if_not_exists: true
      t.replica_identity_index
    end

    add_reference :support_imports, :batch, foreign_key: { to_table: :support_scan_batches }, index: false, if_not_exists: true
    add_index :support_imports, :batch_id, where: "batch_id IS NOT NULL", algorithm: :concurrently, if_not_exists: true
  end
end
