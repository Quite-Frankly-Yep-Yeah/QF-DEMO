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

# One small request to check that a key works, for the settings page's Test
# button. It answers with fixed wording only: the provider's own error text
# is never passed on, since it can quote the key.
module Supports
  module AnthropicConnectionTest
    def self.call(api_key:, model:, client: nil)
      client ||= Anthropic::Client.new(api_key:)
      client.messages.create(model:, max_tokens: 256, messages: [{ role: :user, content: "Reply with the single word OK." }])
      { ok: true, message: I18n.t("It works.") }
    rescue Anthropic::Errors::AuthenticationError, Anthropic::Errors::PermissionDeniedError
      { ok: false, message: I18n.t("The key was rejected.") }
    rescue Anthropic::Errors::NotFoundError, Anthropic::Errors::BadRequestError
      { ok: false, message: I18n.t("That model isn't available to this key.") }
    rescue Anthropic::Errors::APIError
      { ok: false, message: I18n.t("The service couldn't be reached.") }
    end
  end
end
