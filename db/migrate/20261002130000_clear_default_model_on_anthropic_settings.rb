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

class ClearDefaultModelOnAnthropicSettings < ActiveRecord::Migration[8.0]
  tag :postdeploy

  # Rows made before a model could be left unchosen all hold Opus, only because
  # it used to be the column's default. Left alone, that "school default" would
  # beat the site's and the server's choices. Opus is also the app's final
  # fallback, so a school that did choose it loses nothing.
  def up
    Supports::AnthropicSetting.where(model: "claude-opus-5-5").update_all(model: nil)
  end

  def down; end
end
