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

# A CSV import of plans and accommodations from the district's system
# (docs/teacher-workflow-plan.md Phase 1). It is previewed first, then applied,
# and an applied import can be undone. Supports::Importer does the work.
module Supports
  class Import < ApplicationRecord
    self.table_name = "support_imports"

    STATES = %w[previewed applied undone discarded].freeze
    EXTRACTION_STATES = %w[queued running ready failed].freeze

    belongs_to :root_account, class_name: "Account"
    belongs_to :account
    belongs_to :user
    # an IEP scan is for one student, and ends up on the plan it created or changed
    belongs_to :student, class_name: "User", optional: true
    belongs_to :plan, class_name: "Supports::Plan", optional: true

    # the uploaded CSV, and the list of changes applying it made
    encrypts :data
    serialize :applied_changes, coder: JSON
    encrypts :applied_changes
    # what an IEP scan read from the document, as the reviewer edits it
    serialize :extraction, coder: JSON
    encrypts :extraction

    validates :workflow_state, inclusion: { in: STATES }
    validates :extraction_state, inclusion: { in: EXTRACTION_STATES }, allow_nil: true

    before_validation { self.root_account_id ||= account&.resolved_root_account_id }

    def scan?
      format == "iep_scan"
    end

    def as_api_json
      json = {
        id:,
        filename:,
        format:,
        workflow_state:,
        created_at: created_at&.iso8601,
        applied_at: applied_at&.iso8601,
        undone_at: undone_at&.iso8601,
        summary: preview["summary"] || {},
        rows: preview["rows"] || []
      }
      return json unless scan?

      json.merge(
        extraction_state:,
        extraction_error:,
        student: student && { id: student.id.to_s, name: student.name },
        plan_id:,
        scan: preview["scan"] || {}
      )
    end
  end
end
