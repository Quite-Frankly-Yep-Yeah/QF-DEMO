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

    MODELS = %w[claude-opus-5-5 claude-sonnet-5-5 claude-haiku-4-5].freeze
    DEFAULT_MODEL = "claude-opus-5-5"

    belongs_to :root_account, class_name: "Account", optional: true
    belongs_to :updated_by, class_name: "User", optional: true

    encrypts :api_key

    validates :model, inclusion: { in: MODELS }
    validates :root_account_id, uniqueness: true

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
  end
end
