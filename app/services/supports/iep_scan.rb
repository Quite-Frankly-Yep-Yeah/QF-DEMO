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
    PLAN_KEYS = %w[plan_type start_date end_date].freeze
    PARAM_KEYS = IepExtractor::PARAMETER_SCHEMA[:properties].keys.map(&:to_s).freeze

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

    # Applies the reviewer's edits to a scan that has been read. +items+ are
    # {"index", "included", "params"}; +plan+ may change plan_type and the
    # dates; +keep_unmapped+ lists which "not mapped" notes to keep.
    def update_review!(import, items: nil, plan: nil, keep_unmapped: nil, acknowledged_mismatch: nil)
      authorize!(import.student)
      raise ArgumentError, "scan is #{import.extraction_state}" unless import.scan? && import.extraction_state == "ready"
      raise ArgumentError, "import is #{import.workflow_state}" unless import.workflow_state == "previewed"

      extraction = import.extraction.deep_dup
      edit_items(extraction, items) if items
      extraction["plan"] = extraction["plan"].merge(plan.to_h.stringify_keys.slice(*PLAN_KEYS)) if plan
      edit_kept(extraction, keep_unmapped) if keep_unmapped
      extraction["acknowledged_mismatch"] = !!acknowledged_mismatch unless acknowledged_mismatch.nil?
      self.class.revalidate!(extraction)
      import.extraction = extraction
      import.update!(preview: self.class.preview_json(import))
      import
    end

    def apply!(import)
      authorize!(import.student)
      importer_for(import).apply!(import)
    end

    def undo!(import)
      authorize!(import.student)
      importer_for(import).undo!(import)
    end

    # The background job: reads the document and stores the proposal.
    def self.extract(import_id)
      claimed = Import.where(id: import_id, format: FORMAT, extraction_state: "queued").update_all(extraction_state: "running")
      return if claimed.zero?

      import = Import.find(import_id)
      result = IepExtractor.new(import.account).call(data: Base64.strict_decode64(import.data), content_type: import.content_type)
      proposal = proposal_from(result)
      revalidate!(proposal)
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

    # What the review screen shows, built from the import's extraction and
    # what applying each item would do right now.
    def self.preview_json(import)
      extraction = import.extraction || {}
      items = Array(extraction["items"])
      results = Importer.new(import.account, import.user, authorized: true).scan_row_results(import)
      rows = items.each_with_index.map { |item, index| row_json(import, extraction, item, index, results[index]) }
      summary = Importer::ACTIONS.index_with { |action| rows.count { |row| row["action"] == action } }
      summary["blocking"] = items.count { |item| item["included"] && item["errors"].present? } +
                            plan_problems(extraction["plan"]).size
      {
        "summary" => summary,
        "rows" => rows,
        "scan" => {
          "student_name_on_doc" => extraction["student_name"],
          "dob_on_doc" => extraction["dob"],
          "name_found" => extraction["student_name"].present?,
          "mismatch" => mismatch?(extraction["student_name"], import.student),
          "acknowledged_mismatch" => extraction["acknowledged_mismatch"] == true,
          "unmapped" => Array(extraction["unmapped"]),
          "keep_unmapped" => Array(extraction["keep_unmapped"])
        }.merge(extraction["plan"] || {})
      }
    end

    def self.row_json(import, extraction, item, index, result)
      type = AccommodationType.find_by(id: item["type_id"])
      action = if item["errors"].present? then "error"
               elsif !item["included"] then "excluded"
               else result&.dig("action") || "add"
               end
      {
        "line" => index + 1,
        "index" => index,
        "student" => import.student&.name,
        "plan_type" => extraction.dig("plan", "plan_type"),
        "accommodation" => type&.name,
        "kind" => item["kind"],
        "params" => item["params"],
        "action" => action,
        "message" => item["errors"].presence&.join(" ") || result&.dig("message"),
        "source_quote" => item["source_quote"],
        "page" => item["page"],
        "confidence" => item["confidence"],
        "errors" => item["errors"],
        "included" => item["included"]
      }
    end

    # Recomputes every item's errors: its own parameter rules, and one item
    # per accommodation among those included.
    def self.revalidate!(extraction)
      taken = Set.new
      Array(extraction["items"]).each do |item|
        errors = AccommodationType.parameter_errors(item["kind"], item["params"])
        errors << I18n.t("Another included item is already this accommodation.") if item["included"] && !taken.add?(item["type_id"])
        item["errors"] = errors
      end
      extraction
    end

    # Problems with the plan itself (type and dates), as messages.
    def self.plan_problems(plan)
      plan ||= {}
      problems = []
      problems << I18n.t("Choose a plan type.") unless Plan::TYPES.include?(plan["plan_type"])
      dates = %w[start_date end_date].map { |key| plan[key].presence }
      if dates.compact.any? { |date| !date.to_s.match?(IepExtractor::ISO_DATE) || (Date.iso8601(date) rescue nil).nil? } # rubocop:disable Style/RescueModifier
        problems << I18n.t("Dates must look like 2026-09-01.")
      elsif dates.all? && Date.iso8601(dates[1]) < Date.iso8601(dates[0])
        problems << I18n.t("The end date must be on or after the start date.")
      end
      problems
    end

    # Why a scan can't be applied yet; empty when it can.
    def self.blockers(import)
      extraction = import.extraction
      return [I18n.t("The scan isn't ready to apply.")] unless import.extraction_state == "ready" && extraction

      list = plan_problems(extraction["plan"])
      if Array(extraction["items"]).any? { |item| item["included"] && item["errors"].present? }
        list << I18n.t("Fix the items marked with problems first.")
      end
      if mismatch?(extraction["student_name"], import.student) && extraction["acknowledged_mismatch"] != true
        list << I18n.t("The document names a different student. Confirm it's the right one before applying.")
      end
      list
    end

    # The rows Supports::Importer applies for a reviewed scan: one per
    # included item (or one for the plan alone), in the shape a CSV row has.
    def self.rows_for_apply(import)
      extraction = import.extraction || {}
      plan = extraction["plan"] || {}
      included = Array(extraction["items"]).each_with_index.select { |item, _| item["included"] }
      types = AccommodationType.where(id: included.map { |item, _| item["type_id"] }).index_by(&:id)
      base = { student: import.student,
               source: "scan",
               plan_notes: kept_notes(extraction),
               data: { "plan_type" => plan["plan_type"].to_s,
                       "start_date" => plan["start_date"].to_s,
                       "end_date" => plan["end_date"].to_s } }
      return [base.merge(line: 1)] if included.empty?

      included.each_with_index.map do |(item, index), line|
        name = types[item["type_id"]]&.name.to_s
        base.merge(line: line + 1, index:, params: item["params"], data: base[:data].merge("accommodation" => name))
      end
    end

    def self.kept_notes(extraction)
      unmapped = Array(extraction["unmapped"])
      kept = Array(extraction["keep_unmapped"]).filter_map { |index| unmapped[index] }
      return nil if kept.empty?

      lines = kept.map { |note| note["page"] ? "- #{note["text"]} (p. #{note["page"]})" : "- #{note["text"]}" }
      "#{I18n.t("From the IEP scan:")}\n#{lines.join("\n")}"
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

    def edit_items(extraction, edits)
      list = extraction["items"]
      Array(edits).each do |edit|
        edit = edit.to_h.stringify_keys
        item = list[edit["index"].to_i] if edit["index"].to_s.match?(/\A\d+\z/)
        raise Invalid, I18n.t("That item isn't in this scan.") unless item

        item["included"] = !!edit["included"] if edit.key?("included")
        item["params"] = edit["params"].to_h.stringify_keys.slice(*PARAM_KEYS) if edit.key?("params")
      end
    end

    def edit_kept(extraction, indexes)
      indexes = Array(indexes).map { |i| i.to_s.match?(/\A\d+\z/) ? i.to_i : -1 }
      raise Invalid, I18n.t("That note isn't in this scan.") unless indexes.all? { |i| i.between?(0, extraction["unmapped"].size - 1) }

      extraction["keep_unmapped"] = indexes.uniq.sort
    end

    def importer_for(import)
      Importer.new(import.account, @user, authorized: true)
    end

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
