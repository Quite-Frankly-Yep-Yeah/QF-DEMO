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

# The IEPs uploaded together in one bulk scan (docs/superpowers/specs/2026-10-02-iep-bulk-scan-design.md).
# It holds no student data: each scan is a Supports::Import that points at it
# and has no student until a person confirms one.
module Supports
  class ScanBatch < ApplicationRecord
    self.table_name = "support_scan_batches"

    belongs_to :root_account, class_name: "Account"
    belongs_to :account
    belongs_to :user
    has_many :imports, class_name: "Supports::Import", foreign_key: :batch_id, inverse_of: :batch, dependent: nil

    validates :root_account, :account, :user, presence: true

    before_validation { self.root_account_id ||= account&.resolved_root_account_id }
  end
end
