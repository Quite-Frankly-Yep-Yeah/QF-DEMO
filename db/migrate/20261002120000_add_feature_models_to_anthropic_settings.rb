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

class AddFeatureModelsToAnthropicSettings < ActiveRecord::Migration[8.0]
  tag :predeploy

  # rubocop:disable Rails/BulkChangeTable -- a tiny table; each step reads better on its own
  def change
    # no model chosen now means "use the next level", so the column can be empty
    change_column_null :anthropic_settings, :model, true
    change_column_default :anthropic_settings, :model, from: "claude-opus-5-5", to: nil
    # a model per AI feature, e.g. {"iep_scan": "claude-sonnet-5-5"}
    add_column :anthropic_settings, :feature_models, :jsonb, null: false, default: {}
    # on the site row: whether schools may choose models while using the shared key
    add_column :anthropic_settings, :allow_account_models, :boolean, null: false, default: true
  end
  # rubocop:enable Rails/BulkChangeTable
end
