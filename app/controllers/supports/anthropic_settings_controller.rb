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

# The Anthropic key and model for IEP scanning (docs/superpowers/specs/
# 2026-10-02-anthropic-settings-design.md): a school's own, and the site's
# shared one with the policy on whether schools may use their own. A key is
# only ever written here, never returned.
module Supports
  class AnthropicSettingsController < ApplicationController
    TEST_LIMIT = 10

    before_action :require_user
    before_action :find_account

    rescue_from ActiveRecord::RecordInvalid do |error|
      render json: { errors: error.record.errors.full_messages }, status: :unprocessable_content
    end

    # GET /accounts/:account_id/ai_settings
    def page
      return render_unauthorized_action unless school_manager? || site_manager?

      @context = @account
      @page_title = t("AI settings")
      add_crumb t("AI settings")
      add_body_class("full-width")
      @show_left_side = false
      js_env({ AI_SETTINGS: {
               account_id: @account.id.to_s,
               is_site_admin_account: @account.site_admin?,
               can_manage_site: site_manager?,
               models: model_options,
               default_model: AnthropicSetting::DEFAULT_MODEL
             } })
      js_bundle :ai_settings
      render html: '<div id="ai_settings_app"></div>'.html_safe, layout: true
    end

    # GET /api/v1/accounts/:account_id/ai_settings
    def show
      return render_unauthorized_action unless school_manager? || site_manager?

      render json: payload
    end

    # PUT /api/v1/accounts/:account_id/ai_settings   api_key (blank leaves it), model
    def update
      return render_unauthorized_action unless school_manager?

      save(AnthropicSetting.find_or_initialize_by(root_account_id: @account.id), "account", "update")
    end

    # DELETE /api/v1/accounts/:account_id/ai_settings   removes the key, keeps the model
    def destroy
      return render_unauthorized_action unless school_manager?

      save(AnthropicSetting.find_or_initialize_by(root_account_id: @account.id), "account", "delete", remove_key: true)
    end

    # PUT /api/v1/accounts/:account_id/ai_settings/site   api_key, model, allow_account_keys
    def update_site
      return render_unauthorized_action unless site_manager?

      save(AnthropicSetting.find_or_initialize_by(root_account_id: nil), "site", "update")
    end

    # DELETE /api/v1/accounts/:account_id/ai_settings/site
    def destroy_site
      return render_unauthorized_action unless site_manager?

      save(AnthropicSetting.find_or_initialize_by(root_account_id: nil), "site", "delete", remove_key: true)
    end

    # POST /api/v1/accounts/:account_id/ai_settings/test   scope, api_key?, model?
    def test
      site = params[:scope].to_s == "site"
      return render_unauthorized_action unless site ? site_manager? : school_manager?
      return render json: { message: t("Too many tries. Wait a minute and try again.") }, status: :too_many_requests unless within_test_limit?

      setting = site ? AnthropicSetting.site : AnthropicSetting.for_account(@account)
      key = params[:api_key].to_s.strip.presence || setting&.api_key.presence
      return render json: { errors: [t("Enter a key to test.")] }, status: :unprocessable_content unless key

      model = AnthropicSetting::MODELS.include?(params[:model]) ? params[:model] : (setting&.model || AnthropicSetting::DEFAULT_MODEL)
      render json: AnthropicConnectionTest.call(api_key: key, model:)
    end

    private

    def model_options
      labels = {
        "claude-opus-5-5" => t("Claude Opus 5.5 (most capable)"),
        "claude-sonnet-5-5" => t("Claude Sonnet 5.5 (faster, lower cost)"),
        "claude-haiku-4-5" => t("Claude Haiku 4.5 (fastest, lowest cost)")
      }
      AnthropicSetting::MODELS.map { |model| { value: model, label: labels.fetch(model) } }
    end

    def find_account
      @account = Account.find_by(id: params[:account_id])
      render json: { message: t("Account not found.") }, status: :not_found unless @account&.root_account?
    end

    # A school's settings are for the school's own admins; the site admin account has none.
    def school_manager?
      !@account.site_admin? && @account.grants_right?(@current_user, :manage_account_settings)
    end

    def site_manager?
      Account.site_admin.grants_right?(@current_user, :manage_site_settings)
    end

    def save(setting, scope, action, remove_key: false)
      attrs = { updated_by: @current_user }
      attrs[:api_key] = nil if remove_key
      typed = params[:api_key].to_s.strip
      attrs[:api_key] = typed if !remove_key && typed.present?
      attrs[:model] = params[:model] if !remove_key && params[:model].present?
      attrs[:allow_account_keys] = ActiveModel::Type::Boolean.new.cast(params[:allow_account_keys]) if scope == "site" && !remove_key && params.key?(:allow_account_keys)
      setting.assign_attributes(attrs)
      setting.save!
      Rails.logger.info("[anthropic_settings] scope=#{scope} action=#{action} user_id=#{@current_user.id} account_id=#{@account.id}")
      render json: payload
    rescue ActiveRecord::RecordNotUnique
      retry
    end

    def payload
      site = AnthropicSetting.site
      {
        account: @account.site_admin? ? nil : setting_json(AnthropicSetting.for_account(@account)),
        site: site_manager? ? setting_json(site, site: true) : nil,
        policy: { allow_account_keys: site.nil? || site.allow_account_keys },
        in_effect: AnthropicConfig.explain(@account)
      }
    end

    # Never includes the key, only whether there is one and its last four characters.
    def setting_json(setting, site: false)
      return nil unless setting

      json = {
        has_key: setting.key_last4.present?,
        key_last4: setting.key_last4,
        model: setting.model,
        updated_at: setting.updated_at&.iso8601,
        updated_by: setting.updated_by && { id: setting.updated_by.id.to_s, name: setting.updated_by.name }
      }
      json[:allow_account_keys] = setting.allow_account_keys if site
      json
    end

    def within_test_limit?
      key = "supports/anthropic_test/#{@current_user.global_id}"
      count = Rails.cache.increment(key, 1, expires_in: 1.minute)
      if count.nil?
        Rails.cache.write(key, 1, expires_in: 1.minute)
        count = 1
      end
      count <= TEST_LIMIT
    end
  end
end
