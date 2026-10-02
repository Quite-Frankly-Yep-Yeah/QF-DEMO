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

# Plain wording for the 400s the Anthropic API sends that are about the key or
# the account rather than the request, so they aren't reported as a bad file
# or a bad model. Fixed text only: the provider's own wording is never passed on.
module Supports
  module AnthropicErrors
    # A message for +error+ if it is a known key or account problem, else +default+.
    def self.bad_request_message(error, default:)
      text = error.message.to_s.downcase
      if text.include?("workspace")
        I18n.t("This key isn't tied to a workspace. Create a key inside a workspace in the Anthropic console and use that one.")
      elsif text.include?("credit balance")
        I18n.t("The Anthropic account has no credit left.")
      else
        default
      end
    end
  end
end
