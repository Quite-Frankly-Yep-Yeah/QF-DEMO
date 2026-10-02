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
               can_manage_school: school_manager?,
               can_manage_site: site_manager?,
               models: model_options,
               features: AiFeatures.all,
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

      save(@account.id, "account", "update")
    end

    # DELETE /api/v1/accounts/:account_id/ai_settings   removes the key, keeps the model
    def destroy
      return render_unauthorized_action unless school_manager?

      save(@account.id, "account", "delete", remove_key: true)
    end

    # PUT /api/v1/accounts/:account_id/ai_settings/site   api_key, model, allow_account_keys
    def update_site
      return render_unauthorized_action unless site_manager?

      save(nil, "site", "update")
    end

    # DELETE /api/v1/accounts/:account_id/ai_settings/site
    def destroy_site
      return render_unauthorized_action unless site_manager?

      save(nil, "site", "delete", remove_key: true)
    end

    # POST /api/v1/accounts/:account_id/ai_settings/test   scope, api_key?, model?
    def test
      site = params[:scope].to_s == "site"
      return render_unauthorized_action unless site ? site_manager? : school_manager?
      return render json: { message: t("Too many tries. Wait a minute and try again.") }, status: :too_many_requests unless within_test_limit?

      setting = site ? AnthropicSetting.site : AnthropicSetting.for_account(@account)
      key = params[:api_key].to_s.strip.presence || setting&.api_key.presence
      return render json: { errors: [t("Enter a key to test.")] }, status: :unprocessable_content unless key

      problems = AnthropicSetting.key_problems(key)
      return render json: { errors: problems }, status: :unprocessable_content if problems.any?

      model = AnthropicSetting::MODELS.include?(params[:model]) ? params[:model] : model_in_use(setting, site)
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

    def save(root_account_id, scope, action, remove_key: false)
      attempts = 0
      begin
        setting = AnthropicSetting.find_or_initialize_by(root_account_id:)
        setting.assign_attributes(changes_for(setting, scope, remove_key))
        setting.save!
      rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid => e
        # two first saves at once: the other one made the row, so look again
        raise if e.is_a?(ActiveRecord::RecordInvalid) && !e.record.errors.of_kind?(:root_account_id, :taken)

        attempts += 1
        retry if attempts < 3
        raise
      end
      Rails.logger.info("[anthropic_settings] scope=#{scope} action=#{action} user_id=#{@current_user.id} account_id=#{@account.id}")
      render json: payload
    end

    # What a save changes: only what was sent. A blank key leaves the saved one.
    def changes_for(setting, scope, remove_key)
      return { updated_by: @current_user, api_key: nil } if remove_key

      attrs = { updated_by: @current_user }
      typed = params[:api_key].to_s.strip
      attrs[:api_key] = typed if typed.present?
      # a blank model clears the choice, so the next level decides
      attrs[:model] = params[:model].to_s if params.key?(:model)
      attrs[:feature_models] = setting.feature_models.merge(sent_feature_models) if params[:models].respond_to?(:each_pair)
      if scope == "site"
        %i[allow_account_keys allow_account_models].each do |policy|
          attrs[policy] = ActiveModel::Type::Boolean.new.cast(params[policy]) if params[policy].to_s.present?
        end
      end
      attrs
    end

    # {"iep_scan" => "claude-sonnet-5-5"}; a blank value clears that feature's model.
    def sent_feature_models
      params[:models].to_unsafe_h.to_h { |feature, model| [feature.to_s, model.to_s] }
    end

    def payload
      site = AnthropicSetting.site
      {
        account: @account.site_admin? ? nil : setting_json(AnthropicSetting.for_account(@account)),
        site: site_manager? ? setting_json(site, site: true) : nil,
        policy: { allow_account_keys: site.nil? || site.allow_account_keys, allow_account_models: site.nil? || site.allow_account_models },
        features: AiFeatures.all,
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
        feature_models: setting.feature_models,
        updated_at: setting.updated_at&.iso8601,
        updated_by: setting.updated_by && { id: setting.updated_by.id.to_s, name: setting.updated_by.name }
      }
      if site
        json[:allow_account_keys] = setting.allow_account_keys
        json[:allow_account_models] = setting.allow_account_models
      end
      json
    end

    # The model a key would actually be used with: the row's own choice, else what
    # the school's feature settings resolve to, else the app's default.
    def model_in_use(setting, site)
      return setting.model if setting&.model.present?
      return AnthropicSetting::DEFAULT_MODEL if site

      AnthropicConfig.for(@account)&.dig(:model) || AnthropicSetting::DEFAULT_MODEL
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
