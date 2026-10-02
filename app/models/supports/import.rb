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
    # scans uploaded together have no student until a person confirms one
    belongs_to :batch, class_name: "Supports::ScanBatch", optional: true, inverse_of: :imports

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

    # A scan that has been waiting this long was lost (the worker died), so it is shown as failed.
    STALE_AFTER = 15.minutes

    def scan?
      format == "iep_scan"
    end

    # Whether a student is attached. A scan with none is its uploader's alone.
    def matched?
      student_id.present?
    end

    def extraction_stale?
      scan? && workflow_state == "previewed" && %w[queued running].include?(extraction_state) &&
        updated_at < STALE_AFTER.ago
    end

    # What the review screen shows. Built from the encrypted extraction each
    # time, never stored: the preview column isn't encrypted and a scan's
    # preview quotes the document.
    def scan_preview
      extraction.present? ? IepScan.preview_json(self) : {}
    end

    def as_api_json
      shown = scan? ? scan_preview : preview
      json = {
        id:,
        filename:,
        format:,
        workflow_state:,
        created_at: created_at&.iso8601,
        applied_at: applied_at&.iso8601,
        undone_at: undone_at&.iso8601,
        summary: shown["summary"] || {},
        rows: shown["rows"] || []
      }
      return json unless scan?

      stale = extraction_stale?
      json.merge(
        extraction_state: stale ? "failed" : extraction_state,
        extraction_error: stale ? I18n.t("Reading the document took too long. Try again.") : extraction_error,
        student: student && { id: student.id.to_s, name: student.name },
        plan_id:,
        batch_id:,
        match: extraction.is_a?(Hash) ? extraction["match"] : nil,
        scan: shown["scan"] || {}
      )
    end
  end
end
