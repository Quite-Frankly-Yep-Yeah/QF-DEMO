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
    MAX_BYTES = 20.megabytes # the API takes about 32 MB a request, and a file grows by a third when sent
    MAX_IMAGE_BYTES = 5.megabytes # the API's limit for one image
    FORMAT = "iep_scan"
    PLAN_KEYS = %w[plan_type start_date end_date].freeze
    PARAM_KEYS = IepExtractor::PARAMETER_SCHEMA[:properties].keys.map(&:to_s).freeze

    MAX_BATCH_FILES = 25
    MAX_BATCH_BYTES = 200.megabytes

    # A problem with the upload that the user can fix; the message is safe to show.
    class Invalid < StandardError; end

    # The scan has no student yet: a person has to confirm one first.
    class StudentNotConfirmed < ArgumentError
      def initialize(message = I18n.t("Confirm the student first."))
        super
      end
    end

    def initialize(account, user)
      @account = account
      @root_account = account.root_account
      @user = user
    end

    # +file+ is the uploaded file (read, size, content_type, original_filename).
    def create!(student:, file:)
      authorize!(student)
      check_file!(file)

      import = queue_scan(file, student:)
      enqueue(import)
      import
    end

    # Several IEPs at once: one queued scan per file, none with a student until
    # a person confirms one. All or nothing: a bad file refuses the whole batch.
    def create_batch!(files:)
      authorize_batch!
      files = Array(files)
      raise Invalid, I18n.t("Choose at least one file.") if files.empty?
      raise Invalid, I18n.t("Choose at most %{count} files at a time.", count: MAX_BATCH_FILES) if files.size > MAX_BATCH_FILES

      files.each { |file| check_file!(file) }
      raise Invalid, I18n.t("The files add up to more than 200 MB. Upload fewer at a time.") if files.sum(&:size) > MAX_BATCH_BYTES

      # one file at a time, keeping only ids: a batch can hold 200 MB of documents
      ids = []
      batch = ScanBatch.transaction do
        ScanBatch.create!(root_account: @root_account, account: @account, user: @user).tap do |created|
          files.each { |file| ids << queue_scan(file, batch: created).id }
        end
      end
      ids.each { |id| enqueue_id(id) }
      batch
    end

    # Attaches the student a person confirmed (or changes it) for a scan that
    # isn't applied yet. The student has to be one this user may manage.
    def confirm_student!(import, student)
      raise ArgumentError, "not a scan" unless import.scan?

      authorize_import!(import)
      authorize_student!(student)
      # the lock reloads the scan: a copy loaded before someone applied it is refused, and
      # what was acknowledged for the old student does not carry over to the new one
      import.with_lock do
        authorize_import!(import)
        raise ArgumentError, "import is #{import.workflow_state}" unless import.workflow_state == "previewed"

        attrs = { student: }
        if import.student_id != student.id && import.extraction.is_a?(Hash)
          attrs[:extraction] = import.extraction.merge("acknowledged_mismatch" => false)
        end
        import.update!(attrs)
      end
      import
    end

    # An unmatched scan is its uploader's alone, whoever else could manage
    # students; once a student is attached the usual rule applies.
    def authorize_import!(import)
      if import.student.nil?
        allowed = import.user_id == @user.id && Supports.feature_enabled?(@account, :iep_scan) &&
                  StudentSearch.new(@user, @root_account).allowed?
        raise Importer::Forbidden unless allowed
      else
        authorize!(import.student)
      end
    end

    # Puts a failed scan back in the queue.
    def retry!(import)
      unless import.scan? && (import.extraction_state == "failed" || import.extraction_stale?)
        raise ArgumentError, "scan is #{import.extraction_state}"
      end

      authorize_import!(import)
      import.update!(extraction_state: "queued", extraction_error: nil)
      enqueue(import)
      import
    end

    def authorize!(student)
      allowed = student && Supports.feature_enabled?(@account, :iep_scan) && in_school?(student) &&
                Access.new(@user, student, @root_account).can_manage?
      raise Importer::Forbidden unless allowed
    end

    # A student the user may manage, and only one: the search rules and the
    # access rules both have to allow them.
    def authorize_student!(student)
      authorize!(student)
      raise Importer::Forbidden unless StudentSearch.new(@user, @root_account).scope.where(id: student.id).exists?
    end

    # Applies the reviewer's edits to a scan that has been read. +items+ are
    # {"index", "included", "params"}; +plan+ may change plan_type and the
    # dates; +keep_unmapped+ lists which "not mapped" notes to keep.
    def update_review!(import, items: nil, plan: nil, keep_unmapped: nil, acknowledged_mismatch: nil)
      authorize_confirmed!(import)
      raise ArgumentError, "scan is #{import.extraction_state}" unless import.scan? && import.extraction_state == "ready"
      raise ArgumentError, "import is #{import.workflow_state}" unless import.workflow_state == "previewed"

      extraction = import.extraction.deep_dup
      edit_items(extraction, items) if items
      extraction["plan"] = extraction["plan"].merge(plan.to_h.stringify_keys.slice(*PLAN_KEYS)) if plan
      edit_kept(extraction, keep_unmapped) if keep_unmapped
      extraction["acknowledged_mismatch"] = !!acknowledged_mismatch unless acknowledged_mismatch.nil?
      self.class.revalidate!(extraction)
      import.update!(extraction:)
      import
    end

    # The lock reloads the scan, so who may apply it is judged against the student
    # it has now, and a confirmation that landed first is seen.
    def apply!(import)
      import.with_lock do
        authorize_confirmed!(import)
        importer_for(import).apply!(import)
      end
    end

    # Whether +import+ is one the user may see in a list: nothing is shown about a
    # student they can't manage any more.
    def visible?(import)
      authorize_import!(import)
      true
    rescue Importer::Forbidden
      false
    end

    def undo!(import)
      authorize_confirmed!(import)
      importer_for(import).undo!(import)
    end

    # The background job: reads the document and stores the proposal.
    def self.extract(import_id)
      claimed = Import.where(id: import_id, format: FORMAT, extraction_state: "queued").update_all(extraction_state: "running")
      return if claimed.zero?

      import = Import.find(import_id)
      result = IepExtractor.new(import.account).call(data: Base64.strict_decode64(import.data), content_type: import.content_type)
      proposal = proposal_from(result)
      proposal["match"] = match_for(import, result) if import.batch_id && import.student_id.nil?
      revalidate!(proposal)
      # discarded while it was being read: don't bring the text back
      return unless import.reload.workflow_state == "previewed"

      import.update!(extraction: proposal, extraction_state: "ready", extraction_error: nil)
    rescue IepExtractor::Failed => e
      import&.update!(extraction_state: "failed", extraction_error: e.message)
    rescue => e
      # the message could carry document text, so only the class is reported
      Canvas::Errors.capture_exception(:supports_iep_scan, StandardError.new("IEP scan failed (#{e.class})"))
      import&.update!(extraction_state: "failed", extraction_error: I18n.t("The document couldn't be processed."))
    end

    RETENTION_SETTING = "supports_iep_scan_retention_days"
    DEFAULT_RETENTION_DAYS = 7

    # Nightly: an IEP is only kept while it is needed. A preview nobody applied for
    # a week is discarded, and the file of a scan undone that long ago is dropped.
    # An applied scan keeps its file, so the plan can always lead back to it.
    # Returns how many of each were cleaned up.
    def self.purge_stale
      cutoff = Setting.get(RETENTION_SETTING, DEFAULT_RETENTION_DAYS.to_s).to_i.days.ago
      scans = Import.where(format: FORMAT)
      previews = scans.where(workflow_state: "previewed").where(updated_at: ...cutoff)
                      .update_all(workflow_state: "discarded", data: nil, extraction: nil, updated_at: Time.zone.now)
      undone = scans.where(workflow_state: "undone").where(undone_at: ...cutoff).where.not(data: nil)
                    .update_all(data: nil, extraction: nil, updated_at: Time.zone.now)
      { previews:, undone: }
    end

    # The student the document seems to belong to, proposed for a person to confirm.
    def self.match_for(import, result)
      StudentMatcher.new(import.user, import.account.root_account).call(name: result.student_name, student_id: result.student_id).to_h
    end

    def self.proposal_from(result)
      {
        "student_name" => result.student_name,
        "student_id_on_doc" => result.student_id,
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
      results = import.student ? Importer.new(import.account, import.user, authorized: true).scan_row_results(import) : {}
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
      return [I18n.t("Confirm the student first.")] if import.student.nil?

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

      doc = NameMatch.words(name_on_doc)
      known = NameMatch.words(student.name)
      (doc - known).any? && (known - doc).any?
    end

    private

    # Review, apply and undo need a student: the access rule is theirs, and
    # nothing is applied to nobody.
    def authorize_confirmed!(import)
      authorize_import!(import)
      raise StudentNotConfirmed if import.student.nil?
    end

    # Who may start a batch: anyone who may manage plans for some students here.
    def authorize_batch!
      allowed = Supports.feature_enabled?(@account, :iep_scan) && StudentSearch.new(@user, @root_account).allowed?
      raise Importer::Forbidden unless allowed
    end

    def check_file!(file)
      raise Invalid, I18n.t("Choose a PDF, PNG or JPEG file.") unless IepExtractor::CONTENT_TYPES.include?(file.content_type)
      raise Invalid, I18n.t("The file is larger than 20 MB.") if file.size > MAX_BYTES
      if file.content_type.start_with?("image/") && file.size > MAX_IMAGE_BYTES
        raise Invalid, I18n.t("An image can be at most 5 MB. Upload a PDF for a larger file.")
      end
    end

    def queue_scan(file, **owner)
      Import.create!(account: @account,
                     user: @user,
                     format: FORMAT,
                     filename: file.original_filename,
                     content_type: file.content_type,
                     data: Base64.strict_encode64(file.read),
                     extraction_state: "queued",
                     **owner)
    end

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

    # Someone with a login at this school, or a student in one of its courses;
    # access rules alone would let a user id from anywhere through.
    def in_school?(student)
      Pseudonym.active_only.where(account_id: @root_account.id, user_id: student.id).exists? ||
        Enrollment.active.where(user_id: student.id, type: "StudentEnrollment", root_account_id: @root_account.id).exists?
    end

    def importer_for(import)
      Importer.new(import.account, @user, authorized: true)
    end

    def enqueue(import)
      enqueue_id(import.id)
    end

    def enqueue_id(id)
      self.class.delay(singleton: "supports_iep_scan:#{Shard.global_id_for(id)}").extract(id)
    end
  end
end
