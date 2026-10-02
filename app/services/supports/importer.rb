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

require "csv"

# Imports plans and accommodations from the district's system as CSV
# (docs/teacher-workflow-plan.md Phase 1). One row per accommodation; a row
# with no accommodation just makes or updates the plan. Nothing is removed:
# accommodations missing from the file stay as they are. A file is previewed
# first, applied, and can be undone.
#
# Generic columns (header names, any order):
#   student_sis_id or student_login, plan_type (iep, 504, el, other), plan_id,
#   start_date, end_date, case_manager_sis_id, accommodation, parameters,
#   courses (course SIS ids separated by ";"), teacher_note
#
# MISTAR/Q exports will map onto these once we have a sample file (Q13).
module Supports
  class Importer
    MAX_ROWS = 5_000
    ACTIONS = %w[create_plan update_plan add update unchanged error].freeze

    class Forbidden < StandardError; end

    def self.allowed?(user, account)
      Supports.feature_enabled?(account, :supports_plans) &&
        account.grants_right?(user, :supports_manage_plans) &&
        account.grants_right?(user, :supports_view_all_students)
    end

    # +authorized+ is for an IEP scan, which the caller has already checked
    # against the student (Supports::IepScan), since a case manager may apply
    # their own students' scans without the all-students permission.
    def initialize(account, user, authorized: false)
      @account = account
      @root_account = account.root_account
      @user = user
      raise Forbidden unless authorized || self.class.allowed?(user, account)
    end

    # Parses +csv_text+ and saves a previewed import showing what each row
    # would do.
    def preview!(csv_text, filename: nil)
      rows = resolve(parse(csv_text))
      Import.create!(account: @account, user: @user, filename:, data: csv_text, preview: preview_json(rows))
    end

    # Applies a previewed import, working out each row again against the
    # current data, and records what it changed.
    def apply!(import)
      raise ArgumentError, "import is #{import.workflow_state}" unless import.workflow_state == "previewed"

      blockers = import.scan? ? IepScan.blockers(import) : []
      raise ArgumentError, blockers.first if blockers.any?

      changes = []
      touched_plans = Set.new
      Plan.transaction do
        rows = resolve(import.scan? ? IepScan.rows_for_apply(import) : parse(import.data))
        # a scan was reviewed row by row, so it applies whole or not at all
        problem = import.scan? && rows.find { |row| row[:action] == "error" }
        raise ArgumentError, problem[:message] if problem

        plans_by_key = {}
        rows.each do |row|
          next if row[:action] == "error"

          plan = plans_by_key[row[:plan_key]] || row[:plan]
          plan = apply_plan(plan, row, changes)
          plans_by_key[row[:plan_key]] = plan
          touched_plans << plan.id if apply_accommodation(plan, row, changes)
        end
        Plan.where(id: touched_plans.to_a).find_each(&:bump_version!)
        attrs = { workflow_state: "applied", applied_at: Time.zone.now, applied_changes: changes }
        if import.scan?
          attrs[:plan_id] = plans_by_key.values.first&.id
        else
          attrs[:preview] = preview_json(rows)
        end
        import.update!(attrs)
      end
      import
    end

    # Puts back what an applied import changed.
    def undo!(import)
      raise ArgumentError, "import is #{import.workflow_state}" unless import.workflow_state == "applied"

      Plan.transaction do
        touched_plans = Set.new
        Array(import.applied_changes).reverse_each do |change|
          case change["model"]
          when "plan"
            plan = Plan.find_by(id: change["id"])
            next unless plan

            (change["action"] == "create") ? plan.update!(workflow_state: "deleted") : plan.update!(change["before"])
          when "accommodation"
            row = StudentAccommodation.find_by(id: change["id"])
            next unless row

            (change["action"] == "create") ? row.update!(workflow_state: "deleted") : row.update!(change["before"])
            touched_plans << row.support_plan_id
          when "caseload"
            Caseload.where(id: change["id"]).delete_all
          end
        end
        Plan.where(id: touched_plans.to_a).find_each(&:bump_version!)
        import.update!(workflow_state: "undone", undone_at: Time.zone.now)
      end
      import
    end

    # What each row of a scan would do now, by row index (see IepScan.preview_json).
    def scan_row_results(import)
      resolve(IepScan.rows_for_apply(import)).filter_map do |row|
        [row[:index], { "action" => row[:action], "message" => row[:message] }] if row[:index]
      end.to_h
    end

    private

    def parse(csv_text)
      table = CSV.parse(csv_text.to_s.delete_prefix("﻿"), headers: true, skip_blanks: true,
                                                               header_converters: ->(h) { h.to_s.strip.downcase })
      table.first(MAX_ROWS).each_with_index.map do |record, index|
        { line: index + 2, data: record.to_h.transform_values { |v| v.to_s.strip } }
      end
    rescue CSV::MalformedCSVError => e
      [{ line: 1, data: {}, parse_error: I18n.t("The file isn't valid CSV: %{message}", message: e.message) }]
    end

    # Works out what each row would do.
    def resolve(rows)
      seen_plans = {}
      rows.map do |row|
        next row.merge(action: "error", message: row[:parse_error]) if row[:parse_error]

        resolve_row(row, seen_plans)
      end
    end

    def resolve_row(row, seen_plans)
      data = row[:data]
      student = row[:student] || find_student(data)
      return row.merge(action: "error", message: I18n.t("Student not found.")) unless student
      return row.merge(action: "error", student:, message: I18n.t("The student isn't enrolled in this school.")) unless in_account?(student)

      plan_type = data["plan_type"].to_s.downcase.delete(" ")
      plan_type = "504" if plan_type == "504plan"
      return row.merge(action: "error", student:, message: I18n.t("Unknown plan type.")) unless Plan::TYPES.include?(plan_type)

      dates = %w[start_date end_date].to_h { |key| [key, parse_date(data[key])] }
      if dates.values.include?(:invalid)
        return row.merge(action: "error", student:, message: I18n.t("Dates must look like 2026-09-01."))
      end

      manager = nil
      if data["case_manager_sis_id"].present?
        manager = find_user_by_sis(data["case_manager_sis_id"])
        return row.merge(action: "error", student:, message: I18n.t("Case manager not found.")) unless manager
      end

      plan_key = data["plan_id"].presence || "#{student.id}:#{plan_type}"
      plan = find_plan(student, plan_type, data["plan_id"])
      plan_attrs = { plan_type:, start_date: dates["start_date"], end_date: dates["end_date"],
                     case_manager_id: manager&.id, external_id: data["plan_id"].presence }.compact
      if row[:plan_notes].present? && !plan&.notes.to_s.include?(row[:plan_notes])
        plan_attrs[:notes] = [plan&.notes.presence, row[:plan_notes]].compact.join("\n\n")
      end
      first_row_for_plan = !seen_plans.key?(plan_key)
      seen_plans[plan_key] = true

      base = row.merge(student:, plan:, plan_key:, plan_attrs:, plan_type:)
      plan_action = if !plan && first_row_for_plan
                      "create_plan"
                    elsif plan && first_row_for_plan && plan_changes?(plan, plan_attrs)
                      "update_plan"
                    end

      return base.merge(action: plan_action || "unchanged") if data["accommodation"].blank?

      type = Catalog.types(@root_account).find { |t| t.name.casecmp?(data["accommodation"]) }
      return base.merge(action: "error", message: I18n.t("%{name} isn't in the accommodation catalog.", name: data["accommodation"])) unless type

      params = row[:params] || parse_parameters(type, data["parameters"])
      errors = AccommodationType.parameter_errors(type.kind, params)
      return base.merge(action: "error", message: errors.join(" ")) if errors.any?

      course_ids, missing = find_courses(data["courses"])
      return base.merge(action: "error", message: I18n.t("Course not found: %{ids}", ids: missing.join(", "))) if missing.any?

      accommodation_attrs = { "accommodation_type_id" => type.id, "parameters" => params.stringify_keys,
                              "course_ids" => course_ids.sort, "teacher_note" => data["teacher_note"].presence,
                              "start_date" => dates["start_date"], "end_date" => dates["end_date"] }
      existing = plan && plan.accommodations.active.find_by(accommodation_type_id: type.id)
      action = if existing
                 accommodation_changes?(existing, accommodation_attrs) ? "update" : (plan_action || "unchanged")
               elsif plan || !first_row_for_plan
                 "add"
               else
                 "create_plan"
               end
      base.merge(action:, type:, accommodation_attrs:, existing:)
    end

    def apply_plan(plan, row, changes)
      attrs = row[:plan_attrs]
      if plan.nil?
        plan = Plan.create!(attrs.merge(account: @account, student: row[:student], created_by: @user, source: row[:source] || "import"))
        changes << { "model" => "plan", "id" => plan.id, "action" => "create" }
        record_caseload(plan, changes)
      elsif plan_changes?(plan, attrs)
        before = plan.attributes.slice(*attrs.keys.map(&:to_s))
        plan.update!(attrs)
        changes << { "model" => "plan", "id" => plan.id, "action" => "update", "before" => json_safe(before) }
        record_caseload(plan, changes)
      end
      plan
    end

    # The case manager's caseload row, if applying the plan made one.
    def record_caseload(plan, changes)
      return unless plan.case_manager_id

      row = Caseload.find_by(root_account: @root_account, staff_id: plan.case_manager_id, student_id: plan.student_id)
      changes << { "model" => "caseload", "id" => row.id, "action" => "create" } if row && row.created_at > 1.minute.ago
    end

    # Returns whether an accommodation was added or changed.
    def apply_accommodation(plan, row, changes)
      attrs = row[:accommodation_attrs]
      return false unless attrs

      existing = plan.accommodations.active.find_by(accommodation_type_id: attrs["accommodation_type_id"])
      if existing.nil?
        created = plan.accommodations.create!(attrs.merge("last_verified_at" => Time.zone.now))
        changes << { "model" => "accommodation", "id" => created.id, "action" => "create" }
        true
      elsif accommodation_changes?(existing, attrs)
        before = existing.attributes.slice(*attrs.keys, "last_verified_at")
        existing.update!(attrs.merge("last_verified_at" => Time.zone.now))
        changes << { "model" => "accommodation", "id" => existing.id, "action" => "update", "before" => json_safe(before) }
        true
      else
        false
      end
    end

    def plan_changes?(plan, attrs)
      attrs.any? { |key, value| plan.public_send(key) != value }
    end

    def accommodation_changes?(existing, attrs)
      attrs.any? do |key, value|
        current = existing.public_send(key)
        current = current.stringify_keys if current.is_a?(Hash)
        current = current.sort if current.is_a?(Array)
        current != value
      end
    end

    def json_safe(hash)
      hash.transform_values { |value| value.is_a?(Date) || value.is_a?(Time) ? value.iso8601 : value }
    end

    def find_student(data)
      if data["student_sis_id"].present?
        find_user_by_sis(data["student_sis_id"])
      elsif data["student_login"].present?
        Pseudonym.active_only.where(account_id: @root_account.id).by_unique_id(data["student_login"]).first&.user
      end
    end

    def find_user_by_sis(sis_id)
      Pseudonym.active_only.where(account_id: @root_account.id, sis_user_id: sis_id).first&.user
    end

    def in_account?(student)
      return true if @account.root_account?

      account_ids = Account.sub_account_ids_recursive(@account.id) + [@account.id]
      Enrollment.where(user_id: student.id, type: "StudentEnrollment", workflow_state: "active")
                .joins(:course).where(courses: { account_id: account_ids }).exists?
    end

    def find_plan(student, plan_type, external_id)
      scope = Plan.not_deleted.where(root_account: @root_account)
      return scope.find_by(external_id:) if external_id.present?

      scope.active.where(student:, plan_type:, account: @account).order(:id).first
    end

    def find_courses(text)
      sis_ids = text.to_s.split(";").map(&:strip).compact_blank
      return [[], []] if sis_ids.empty?

      found = Course.where(root_account_id: @root_account.id, sis_source_id: sis_ids).pluck(:sis_source_id, :id).to_h
      [found.values, sis_ids - found.keys]
    end

    def parse_date(text)
      return nil if text.blank?

      Date.iso8601(text)
    rescue Date::Error
      :invalid
    end

    # Reads a plain-language parameter like "1.5x", "30 minutes", "25% lower"
    # or "2" for the catalog item's kind. Blank means the catalog default.
    def parse_parameters(type, text)
      return type.default_parameters.to_h.stringify_keys if text.blank?

      text = text.downcase
      number = text[/\d+(\.\d+)?/]
      case type.kind
      when "extended_time"
        text.include?("x") ? { "multiplier" => number.to_f } : { "minutes" => number.to_i }
      when "extended_deadlines"
        { "percent" => number.to_i, "mode" => (text.match?(/daily|lower/) ? "lower_daily" : "extend_finish") }
      when "extra_attempts"
        { "attempts" => number.to_i }
      when "check_ins"
        { "every_days" => number.to_i }
      when "display"
        { "setting" => (text.include?("dyslex") ? "use_dyslexic_font" : "high_contrast") }
      else
        {}
      end
    end

    def preview_json(rows)
      summary = ACTIONS.index_with { |action| rows.count { |row| row[:action] == action } }
      {
        "summary" => summary,
        "rows" => rows.map do |row|
          {
            "line" => row[:line],
            "student" => row[:student]&.name,
            "plan_type" => row[:plan_type],
            "accommodation" => row[:type]&.name || row[:data]["accommodation"].presence,
            "action" => row[:action],
            "message" => row[:message]
          }
        end
      }
    end
  end
end
