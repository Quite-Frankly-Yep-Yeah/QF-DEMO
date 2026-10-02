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

# The AI features that have a model setting of their own. Adding a feature is
# one entry here; its setting then shows up on the AI settings page.
module Supports
  module AiFeatures
    FEATURES = {
      iep_scan: -> { I18n.t("IEP scan") }
    }.freeze

    def self.keys
      FEATURES.keys
    end

    def self.valid?(key)
      FEATURES.key?(key.to_s.to_sym)
    end

    def self.label(key)
      FEATURES.fetch(key.to_sym).call
    end

    def self.all
      keys.map { |key| { key:, label: label(key) } }
    end
  end
end
