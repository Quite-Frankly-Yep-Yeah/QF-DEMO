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

# Which Anthropic key and model IEP scanning uses for a school: its own key
# (unless the site forbids that), else the site's shared key, else the
# server's anthropic.yml, else none.
module Supports
  module AnthropicConfig
    FILE = "anthropic.yml"

    # { api_key:, model:, source: :account | :site | :file }, or nil.
    def self.for(root_account)
      resolve(root_account)
    end

    # What the settings page says: where the key comes from, and whether the
    # school has a key of its own that the site isn't letting it use.
    def self.explain(root_account)
      chosen = resolve(root_account)
      school = AnthropicSetting.for_account(root_account)
      site = AnthropicSetting.site
      ignored = !!(school&.key? && site && !site.allow_account_keys)
      { source: chosen&.dig(:source), model: chosen&.dig(:model), account_key_ignored: ignored }
    end

    def self.resolve(root_account)
      school = AnthropicSetting.for_account(root_account)
      site = AnthropicSetting.site
      if school&.key? && (site.nil? || site.allow_account_keys)
        entry(school.api_key, school.model, :account)
      elsif site&.key?
        entry(site.api_key, site.model, :site)
      else
        file = file_settings
        entry(file["api_key"], file["model"], :file) if file["api_key"].present?
      end
    end
    private_class_method :resolve

    def self.entry(api_key, model, source)
      { api_key:, model: AnthropicSetting::MODELS.include?(model) ? model : AnthropicSetting::DEFAULT_MODEL, source: }
    end
    private_class_method :entry

    def self.file_settings
      YAML.safe_load(DynamicSettings.find(tree: :private)[FILE] || "{}") || {}
    end
    private_class_method :file_settings
  end
end
