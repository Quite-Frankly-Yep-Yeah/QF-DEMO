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

class CreateAnthropicSettings < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :anthropic_settings do |t|
      # null is the one site-wide row
      t.references :root_account, foreign_key: { to_table: :accounts }, index: false # rubocop:disable Migration/RootAccountId
      # encrypted; only the last four characters are kept in the clear
      t.text :api_key
      t.string :key_last4, limit: 4
      t.string :model, null: false, default: "claude-opus-5-5", limit: 255
      # on the site-wide row: whether schools may use a key of their own
      t.boolean :allow_account_keys, null: false, default: true
      t.references :updated_by, foreign_key: { to_table: :users }, index: false
      t.timestamps

      t.index :root_account_id,
              unique: true,
              where: "root_account_id IS NOT NULL",
              name: "index_anthropic_settings_on_root_account"
      t.index "((root_account_id IS NULL))",
              unique: true,
              where: "root_account_id IS NULL",
              name: "index_anthropic_settings_one_site_row"
      t.replica_identity_index
    end
  end
end
