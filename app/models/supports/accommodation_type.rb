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

# An entry in the school's accommodation catalog (docs/teacher-workflow-plan.md
# §2.3). Its kind says how the app applies it: some kinds act on their own
# (Phase 2), the rest are instructions for the teacher.
module Supports
  class AccommodationType < ApplicationRecord
    self.table_name = "accommodation_types"

    KINDS = %w[
      extended_time
      extended_deadlines
      extra_attempts
      reduced_workload
      check_ins
      display
      informational
    ].freeze

    # What each kind's parameters look like, and their allowed values.
    DISPLAY_SETTINGS = %w[high_contrast use_dyslexic_font].freeze
    PACING_MODES = %w[extend_finish lower_daily].freeze

    belongs_to :root_account, class_name: "Account"
    has_many :student_accommodations, class_name: "Supports::StudentAccommodation", inverse_of: :accommodation_type

    validates :name, presence: true, length: { maximum: 255 }
    validates :kind, inclusion: { in: KINDS }
    validates :workflow_state, inclusion: { in: %w[active deleted] }
    validate :parameters_valid

    scope :active, -> { where(workflow_state: "active").order(:position, :name) }

    def self.kind_label(kind)
      case kind
      when "extended_time" then I18n.t("Extended time (applied to timed quizzes)")
      when "extended_deadlines" then I18n.t("Extended deadlines (applied to pacing)")
      when "extra_attempts" then I18n.t("Extra attempts (applied to quizzes)")
      when "reduced_workload" then I18n.t("Reduced workload (teacher chooses items)")
      when "check_ins" then I18n.t("Frequent check-ins (follow-up reminders)")
      when "display" then I18n.t("Display setting (turned on for the student)")
      else I18n.t("Instructions for the teacher")
      end
    end

    # Checks a kind's parameters and returns a list of error messages.
    def self.parameter_errors(kind, params)
      params = (params || {}).stringify_keys
      case kind
      when "extended_time"
        multiplier = params["multiplier"]
        minutes = params["minutes"]
        if multiplier.blank? && minutes.blank?
          [I18n.t("Give a time multiplier or a number of extra minutes.")]
        elsif multiplier.present? && !(multiplier.to_f > 1 && multiplier.to_f <= 5)
          [I18n.t("The time multiplier must be more than 1 and at most 5.")]
        elsif minutes.present? && !(minutes.to_i.positive? && minutes.to_i <= 10_080)
          [I18n.t("Extra minutes must be between 1 and 10,080.")]
        else
          []
        end
      when "extended_deadlines"
        errors = []
        errors << I18n.t("The pacing change must be between 1 and 200 percent.") unless params["percent"].to_i.between?(1, 200)
        errors << I18n.t("Choose how pacing changes.") unless PACING_MODES.include?(params["mode"])
        errors
      when "extra_attempts"
        params["attempts"].to_i.between?(1, 10) ? [] : [I18n.t("Extra attempts must be between 1 and 10.")]
      when "check_ins"
        params["every_days"].to_i.between?(1, 60) ? [] : [I18n.t("Check-ins must be every 1 to 60 days.")]
      when "display"
        DISPLAY_SETTINGS.include?(params["setting"]) ? [] : [I18n.t("Choose a display setting.")]
      else
        []
      end
    end

    # A short plain-language description of +params+ for this kind.
    def self.parameters_text(kind, params)
      params = (params || {}).stringify_keys
      case kind
      when "extended_time"
        if params["multiplier"].present?
          I18n.t("%{multiplier}x time on timed quizzes", multiplier: params["multiplier"].to_f.round(2).to_s.delete_suffix(".0"))
        else
          I18n.t("%{minutes} extra minutes on timed quizzes", minutes: params["minutes"].to_i)
        end
      when "extended_deadlines"
        if params["mode"] == "lower_daily"
          I18n.t("Daily work target lowered by %{percent}%%", percent: params["percent"].to_i)
        else
          I18n.t("Finish date moved out by %{percent}%%", percent: params["percent"].to_i)
        end
      when "extra_attempts"
        I18n.t({ one: "1 extra attempt on quizzes", other: "%{count} extra attempts on quizzes" }, count: params["attempts"].to_i)
      when "check_ins"
        I18n.t({ one: "Check in every day", other: "Check in every %{count} days" }, count: params["every_days"].to_i)
      when "display"
        (params["setting"] == "high_contrast") ? I18n.t("High contrast display") : I18n.t("Dyslexia-friendly font")
      end
    end

    def as_api_json
      {
        id:,
        name:,
        kind:,
        kind_label: self.class.kind_label(kind),
        instructions:,
        default_parameters:,
        position:
      }
    end

    private

    def parameters_valid
      return if kind == "informational" || default_parameters.blank?

      self.class.parameter_errors(kind, default_parameters).each { |message| errors.add(:default_parameters, message) }
    end
  end
end
