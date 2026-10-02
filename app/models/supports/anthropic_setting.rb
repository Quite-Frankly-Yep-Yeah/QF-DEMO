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

# The Anthropic API key and model for IEP scanning, kept per school (a root
# account) or once for the whole site (root_account_id nil). The key is
# encrypted and only ever written: nothing reads it back out to a person.
module Supports
  class AnthropicSetting < ApplicationRecord
    self.table_name = "anthropic_settings"

    MODELS = AiModels.ids.freeze
    DEFAULT_MODEL = "claude-opus-5-5"

    belongs_to :root_account, class_name: "Account", optional: true
    belongs_to :updated_by, class_name: "User", optional: true

    encrypts :api_key

    validates :model, inclusion: { in: MODELS }, allow_nil: true
    before_validation :drop_stale_choices
    validate :feature_models_are_valid
    validates :root_account_id, uniqueness: true
    validate :key_is_usable

    MIN_KEY_LENGTH = 8

    # Why a typed key can't be right, without quoting it. A key wrapped by an
    # email client keeps a line break inside, which only fails later as an
    # outage, so it is refused here.
    def self.key_problems(key)
      key = key.to_s.strip
      problems = []
      problems << I18n.t("The key can't contain spaces or line breaks.") if key.match?(/\s/)
      problems << I18n.t("The key is too short.") if key.length < MIN_KEY_LENGTH
      problems
    end

    def self.site
      find_by(root_account_id: nil)
    end

    def self.for_account(root_account)
      find_by(root_account_id: root_account.id)
    end

    # Blank means no key. Surrounding spaces and newlines from pasting are dropped.
    def api_key=(value)
      value = value.to_s.strip.presence
      super
      self.key_last4 = value&.last(4)
    end

    def key?
      api_key.present?
    end

    # A blank model means none chosen: the next level decides.
    def model=(value)
      super(value.presence)
    end

    # Keys become strings and blank choices are dropped.
    def feature_models=(value)
      super((value || {}).to_h.to_h { |feature, model| [feature.to_s, model.to_s.strip] }.compact_blank)
    end

    private

    # A model that is no longer offered, left over from before, mustn't stop the row
    # from being saved, so it is dropped. A new choice that isn't offered still fails.
    def drop_stale_choices
      self.model = nil if model.present? && !MODELS.include?(model) && !model_changed?
      kept = feature_models.reject do |feature, chosen|
        (!AiFeatures.valid?(feature) || !MODELS.include?(chosen)) && feature_models_was&.dig(feature) == chosen
      end
      self.feature_models = kept unless kept == feature_models
    end

    def feature_models_are_valid
      feature_models.each do |feature, model|
        errors.add(:feature_models, I18n.t("includes an unknown AI feature")) unless AiFeatures.valid?(feature)
        errors.add(:feature_models, I18n.t("includes a model that isn't offered")) unless MODELS.include?(model)
      end
    end

    def key_is_usable
      key = api_key
      return if key.blank?

      self.class.key_problems(key).each { |problem| errors.add(:api_key, problem) }
    end
  end
end
