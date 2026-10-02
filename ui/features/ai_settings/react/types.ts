/*
 * Copyright (C) 2026 - present quite frankly an example LMS contributors
 *
 * This file is part of quite frankly an example LMS, a modified version of Canvas.
 *
 * quite frankly an example LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * quite frankly an example LMS is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

// window.ENV.AI_SETTINGS (Supports::AnthropicSettingsController#page)
export type AiSettingsConfig = {
  account_id: string
  is_site_admin_account: boolean
  can_manage_school: boolean
  can_manage_site: boolean
  models: {value: string; label: string}[]
  default_model: string
}

// Supports::AnthropicSettingsController#setting_json: never includes the key
export type SettingJson = {
  has_key: boolean
  key_last4: string | null
  model: string
  updated_at: string | null
  updated_by: {id: string; name: string} | null
  allow_account_keys?: boolean
}

// GET /api/v1/accounts/:account_id/ai_settings
export type SettingsResponse = {
  account: SettingJson | null
  site: SettingJson | null
  policy: {allow_account_keys: boolean}
  in_effect: {
    source: 'account' | 'site' | 'file' | null
    model: string | null
    account_key_ignored: boolean
  }
}

export type SaveBody = {api_key?: string; model?: string; allow_account_keys?: boolean}
