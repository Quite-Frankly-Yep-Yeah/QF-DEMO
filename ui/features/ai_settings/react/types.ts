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

export type ModelInfo = {
  value: string
  label: string
  summary: string
  use_when: string
  // list prices in dollars per million tokens
  input_price: number
  output_price: number
  context_tokens: number
  supports_effort: boolean
  cost_vs_cheapest: number
}

// the AI features that have a model of their own; +recommended+ is empty until one is chosen
export type FeatureInfo = {
  key: string
  label: string
  recommended: string | null
  why: string | null
}

// window.ENV.AI_SETTINGS (Supports::AnthropicSettingsController#page)
export type AiSettingsConfig = {
  account_id: string
  is_site_admin_account: boolean
  can_manage_school: boolean
  can_manage_site: boolean
  models: ModelInfo[]
  prices_checked: string
  default_model: string
  features: FeatureInfo[]
}

// Supports::AnthropicSettingsController#setting_json: never includes the key
export type SettingJson = {
  has_key: boolean
  key_last4: string | null
  model: string | null
  feature_models: Record<string, string>
  updated_at: string | null
  updated_by: {id: string; name: string} | null
  allow_account_keys?: boolean
  allow_account_models?: boolean
}

export type ModelSource =
  | 'account_feature'
  | 'account_default'
  | 'site_feature'
  | 'site_default'
  | 'file'
  | 'default'

// GET /api/v1/accounts/:account_id/ai_settings
export type SettingsResponse = {
  account: SettingJson | null
  site: SettingJson | null
  policy: {allow_account_keys: boolean; allow_account_models: boolean}
  features: FeatureInfo[]
  in_effect: {
    source: 'account' | 'site' | 'file' | null
    model: string | null
    model_source: ModelSource | null
    account_key_ignored: boolean
    school_models_ignored: boolean
    features: {
      feature: string
      label: string
      model: string | null
      model_source: ModelSource | null
    }[]
  }
}

export type SaveBody = {
  api_key?: string
  // a blank model clears the choice
  model?: string
  models?: Record<string, string>
  allow_account_keys?: boolean
  allow_account_models?: boolean
}
