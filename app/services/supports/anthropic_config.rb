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

# Which Anthropic key and model an AI feature uses for a school.
#
# Key: the school's own (unless the site forbids that), else the site's shared
# key, else the server's anthropic.yml, else none.
#
# Model, first that is set: the school's choice for the feature, the school's
# default, the site's choice for the feature, the site's default, anthropic.yml's,
# else the app's default. The school's choices count when the school uses its
# own key, or the site lets schools choose models on the shared key.
module Supports
  module AnthropicConfig
    FILE = "anthropic.yml"

    # { api_key:, model:, source: :account | :site | :file, model_source: }, or nil
    # when there is no key. Pass +feature+ (a key of AiFeatures) for that
    # feature's model; without it only the default models are considered.
    def self.for(root_account, feature: nil)
      resolve(root_account, feature)
    end

    # What the settings page says: where the key comes from, what each feature
    # uses, and whether the school's choices are being ignored by the site.
    def self.explain(root_account)
      school = AnthropicSetting.for_account(root_account)
      site = AnthropicSetting.site
      chosen = resolve(root_account, nil)
      keys_ignored = !!(school&.key? && site && !site.allow_account_keys)
      models_ignored = !!(chosen && chosen[:source] != :account && site && !site.allow_account_models && school_chose_models?(school))
      {
        source: chosen&.dig(:source),
        model: chosen&.dig(:model),
        model_source: chosen&.dig(:model_source),
        account_key_ignored: keys_ignored,
        school_models_ignored: models_ignored,
        features: AiFeatures.all.map do |feature|
          found = resolve(root_account, feature[:key])
          { feature: feature[:key], label: feature[:label], model: found&.dig(:model), model_source: found&.dig(:model_source) }
        end
      }
    end

    def self.resolve(root_account, feature)
      school = AnthropicSetting.for_account(root_account)
      site = AnthropicSetting.site
      file = file_settings
      source, api_key = if school&.key? && (site.nil? || site.allow_account_keys)
                          [:account, school.api_key]
                        elsif site&.key?
                          [:site, site.api_key]
                        elsif file["api_key"].present?
                          [:file, file["api_key"]]
                        end
      return nil unless source

      model, model_source = pick_model(feature, school, site, file, own_key: source == :account)
      { api_key:, model:, source:, model_source: }
    end
    private_class_method :resolve

    def self.pick_model(feature, school, site, file, own_key:)
      school_counts = own_key || site.nil? || site.allow_account_models
      candidates = []
      candidates << [:account_feature, school&.feature_models&.dig(feature.to_s)] if school_counts && feature
      candidates << [:account_default, school&.model] if school_counts
      candidates << [:site_feature, site&.feature_models&.dig(feature.to_s)] if feature
      candidates << [:site_default, site&.model]
      candidates << [:file, file["model"]]
      found = candidates.find { |_, model| AnthropicSetting::MODELS.include?(model) }
      found ? [found[1], found[0]] : [AnthropicSetting::DEFAULT_MODEL, :default]
    end
    private_class_method :pick_model

    def self.school_chose_models?(school)
      !!school && (school.model.present? || school.feature_models.present?)
    end
    private_class_method :school_chose_models?

    def self.file_settings
      YAML.safe_load(DynamicSettings.find(tree: :private)[FILE] || "{}") || {}
    end
    private_class_method :file_settings
  end
end
