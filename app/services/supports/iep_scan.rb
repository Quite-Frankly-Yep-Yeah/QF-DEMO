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

require "base64"

# An IEP scan's life, from upload to a reviewable proposal. It saves a queued
# Supports::Import (format "iep_scan") holding the encrypted document, reads
# it in the background with Supports::IepExtractor, and stores what was read
# as the import's editable extraction plus a preview. Nothing becomes a plan
# or an accommodation until the import is applied.
module Supports
  class IepScan
    MAX_BYTES = 10.megabytes
    FORMAT = "iep_scan"

    # A problem with the upload that the user can fix; the message is safe to show.
    class Invalid < StandardError; end

    def initialize(account, user)
      @account = account
      @root_account = account.root_account
      @user = user
    end

    # +file+ is the uploaded file (read, size, content_type, original_filename).
    def create!(student:, file:)
      authorize!(student)
      raise Invalid, I18n.t("Choose a PDF, PNG or JPEG file.") unless IepExtractor::CONTENT_TYPES.include?(file.content_type)
      raise Invalid, I18n.t("The file is larger than 10 MB.") if file.size > MAX_BYTES

      import = Import.create!(account: @account,
                              user: @user,
                              student:,
                              format: FORMAT,
                              filename: file.original_filename,
                              content_type: file.content_type,
                              data: Base64.strict_encode64(file.read),
                              extraction_state: "queued")
      enqueue(import)
      import
    end

    # Puts a failed scan back in the queue.
    def retry!(import)
      raise ArgumentError, "scan is #{import.extraction_state}" unless import.scan? && import.extraction_state == "failed"

      authorize!(import.student)
      import.update!(extraction_state: "queued", extraction_error: nil)
      enqueue(import)
      import
    end

    # The background job: reads the document and stores the proposal.
    def self.extract(import_id)
      claimed = Import.where(id: import_id, format: FORMAT, extraction_state: "queued").update_all(extraction_state: "running")
      return if claimed.zero?

      import = Import.find(import_id)
      result = IepExtractor.new(import.account).call(data: Base64.strict_decode64(import.data), content_type: import.content_type)
      proposal = proposal_from(result)
      import.update!(extraction: proposal, extraction_state: "ready", extraction_error: nil)
      import.update!(preview: preview_json(import))
    rescue IepExtractor::Failed => e
      import&.update!(extraction_state: "failed", extraction_error: e.message)
    rescue => e
      # the message could carry document text, so only the class is reported
      Canvas::Errors.capture_exception(:supports_iep_scan, StandardError.new("IEP scan failed (#{e.class})"))
      import&.update!(extraction_state: "failed", extraction_error: I18n.t("The document couldn't be processed."))
    end

    def self.proposal_from(result)
      {
        "student_name" => result.student_name,
        "dob" => result.dob,
        "plan" => { "plan_type" => result.plan_type, "start_date" => result.start_date, "end_date" => result.end_date },
        "items" => result.items,
        "unmapped" => result.unmapped,
        "keep_unmapped" => [],
        "acknowledged_mismatch" => false
      }
    end

    # What the review screen shows, built from the import's extraction.
    def self.preview_json(import)
      extraction = import.extraction || {}
      items = Array(extraction["items"])
      rows = items.each_with_index.map { |item, index| row_json(import, extraction, item, index) }
      summary = Importer::ACTIONS.index_with { |action| rows.count { |row| row["action"] == action } }
      summary["blocking"] = items.count { |item| item["included"] && item["errors"].present? }
      {
        "summary" => summary,
        "rows" => rows,
        "scan" => {
          "student_name_on_doc" => extraction["student_name"],
          "dob_on_doc" => extraction["dob"],
          "name_found" => extraction["student_name"].present?,
          "mismatch" => mismatch?(extraction["student_name"], import.student),
          "unmapped" => Array(extraction["unmapped"])
        }.merge(extraction["plan"] || {})
      }
    end

    def self.row_json(import, extraction, item, index)
      type = AccommodationType.find_by(id: item["type_id"])
      {
        "line" => index + 1,
        "index" => index,
        "student" => import.student&.name,
        "plan_type" => extraction.dig("plan", "plan_type"),
        "accommodation" => type&.name,
        "kind" => item["kind"],
        "params" => item["params"],
        "action" => item["errors"].present? ? "error" : "add",
        "message" => item["errors"].presence&.join(" "),
        "source_quote" => item["source_quote"],
        "page" => item["page"],
        "confidence" => item["confidence"],
        "errors" => item["errors"],
        "included" => item["included"]
      }
    end

    # Names are compared as sets of words, so order, case, punctuation and a
    # middle name don't matter. A document with no name isn't a mismatch.
    def self.mismatch?(name_on_doc, student)
      return false if name_on_doc.blank? || student.nil?

      words = ->(text) { text.to_s.downcase.scan(/[[:alpha:]]+/) }
      doc = words.call(name_on_doc)
      known = words.call(student.name)
      (doc - known).any? && (known - doc).any?
    end

    private

    def authorize!(student)
      allowed = student && Supports.feature_enabled?(@account, :iep_scan) &&
                Access.new(@user, student, @root_account).can_manage?
      raise Importer::Forbidden unless allowed
    end

    def enqueue(import)
      self.class.delay(singleton: "supports_iep_scan:#{import.global_id}").extract(import.id)
    end
  end
end
