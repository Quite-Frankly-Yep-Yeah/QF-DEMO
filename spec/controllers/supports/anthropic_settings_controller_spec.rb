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

describe Supports::AnthropicSettingsController do
  let_once(:root_account) { Account.default }
  let_once(:school_admin) { account_admin_user(account: root_account) }
  let_once(:site_admin) { site_admin_user }
  let_once(:teacher) { teacher_in_course(account: root_account, active_all: true).user }
  let_once(:sub_account) { root_account.sub_accounts.create!(name: "Lincoln High") }

  let(:key) { "sk-ant-api03-SECRETKEY-4f2a" }

  def json
    json_parse(response.body)
  end

  def logged
    messages = []
    allow(Rails.logger).to receive(:info).and_wrap_original do |original, *args, &block|
      messages << args.first.to_s
      original.call(*args, &block)
    end
    yield
    messages
  end

  def put_school(account: root_account, **params)
    put :update, params: { account_id: account.id, **params }, as: :json
  end

  def put_site(**params)
    put :update_site, params: { account_id: root_account.id, **params }, as: :json
  end

  describe "the school's key" do
    before { user_session(school_admin) }

    it "reports no key before one is saved" do
      get :show, params: { account_id: root_account.id }
      expect(response).to be_successful
      expect(json).to include("account" => nil, "site" => nil, "policy" => { "allow_account_keys" => true, "allow_account_models" => true })
      expect(json["in_effect"]).to include("source" => nil)
    end

    it "saves a key and then shows only its last four, and never the key" do
      put_school(api_key: key, model: "claude-sonnet-5-5")
      expect(response).to be_successful
      expect(response.body).not_to include(key)
      expect(json["account"]).to include("has_key" => true, "key_last4" => "4f2a", "model" => "claude-sonnet-5-5")
      expect(Supports::AnthropicSetting.for_account(root_account)).to have_attributes(api_key: key, updated_by: school_admin)

      get :show, params: { account_id: root_account.id }
      expect(response.body).not_to include(key)
      expect(json["in_effect"]).to include("source" => "account", "model" => "claude-sonnet-5-5")
    end

    it "leaves the key alone when none is sent, or it is blank or only spaces" do
      put_school(api_key: key)
      [{}, { api_key: "" }, { api_key: "   " }, { api_key: nil }].each do |params|
        put_school(**params, model: "claude-haiku-4-5")
        expect(response).to be_successful
        expect(Supports::AnthropicSetting.for_account(root_account)).to have_attributes(api_key: key, model: "claude-haiku-4-5")
      end
    end

    it "trims spaces and newlines around a pasted key" do
      put_school(api_key: "  #{key}\n")
      expect(Supports::AnthropicSetting.for_account(root_account).api_key).to eq key
    end

    it "refuses a model that isn't offered, without echoing the key" do
      put_school(api_key: key, model: "gpt-4")
      expect(response).to have_http_status(:unprocessable_content)
      expect(response.body).not_to include(key)
    end

    it "removes only the key" do
      put_school(api_key: key, model: "claude-sonnet-5-5")
      delete :destroy, params: { account_id: root_account.id }
      expect(response).to be_successful
      expect(response.body).not_to include(key)
      expect(json["account"]).to include("has_key" => false, "key_last4" => nil, "model" => "claude-sonnet-5-5")
      expect(Supports::AnthropicSetting.for_account(root_account).api_key).to be_nil
    end

    it "logs who changed what, never the key" do
      lines = logged { put_school(api_key: key) }
      expect(lines.grep(/scope=account action=update user_id=#{school_admin.id}/).size).to eq 1
      expect(lines.join).not_to include(key)
      lines = logged { delete :destroy, params: { account_id: root_account.id } }
      expect(lines.grep(/scope=account action=delete user_id=#{school_admin.id}/).size).to eq 1
    end

    it "says a school key is being ignored when the site forbids it, and uses it again when allowed" do
      put_school(api_key: key)
      Supports::AnthropicSetting.create!(root_account: nil, api_key: "site-key", allow_account_keys: false)
      get :show, params: { account_id: root_account.id }
      expect(json["policy"]).to include("allow_account_keys" => false)
      expect(json["in_effect"]).to include("source" => "site", "account_key_ignored" => true)
      Supports::AnthropicSetting.site.update!(allow_account_keys: true)
      get :show, params: { account_id: root_account.id }
      expect(json["in_effect"]).to include("source" => "account", "account_key_ignored" => false)
    end
  end

  describe "who may use it" do
    it "refuses a teacher" do
      user_session(teacher)
      get :show, params: { account_id: root_account.id }, format: :json
      expect(response).to have_http_status(:forbidden)
      put_school(api_key: key)
      expect(response).to have_http_status(:forbidden)
      expect(Supports::AnthropicSetting.count).to eq 0
    end

    it "treats a sub-account as not found, even for its admin" do
      user_session(account_admin_user(account: sub_account))
      get :show, params: { account_id: sub_account.id }
      expect(response).to have_http_status(:not_found)
      put_school(account: sub_account, api_key: key)
      expect(response).to have_http_status(:not_found)
    end

    it "keeps the site's key and policy from a school admin" do
      user_session(school_admin)
      put_site(api_key: key, allow_account_keys: false)
      expect(response).to have_http_status(:forbidden)
      delete :destroy_site, params: { account_id: root_account.id }, format: :json
      expect(response).to have_http_status(:forbidden)
      post :test, params: { account_id: root_account.id, scope: "site", api_key: key }, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(Supports::AnthropicSetting.count).to eq 0
    end

    it "needs someone signed in" do
      get :show, params: { account_id: root_account.id }, format: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "the site's key and policy" do
    before { user_session(site_admin) }

    it "saves the shared key and the policy, and never returns the key" do
      put_site(api_key: key, model: "claude-haiku-4-5", allow_account_keys: false)
      expect(response).to be_successful
      expect(response.body).not_to include(key)
      expect(json["site"]).to include("has_key" => true,
                                      "key_last4" => "4f2a",
                                      "model" => "claude-haiku-4-5",
                                      "allow_account_keys" => false)
      expect(Supports::AnthropicSetting.site).to have_attributes(api_key: key, allow_account_keys: false, updated_by: site_admin)
    end

    it "shows a site admin the site section on a school's page" do
      get :show, params: { account_id: root_account.id }
      expect(json).to have_key("site")
      expect(json["site"]).to be_nil
    end

    it "removes the shared key without touching the policy" do
      put_site(api_key: key, allow_account_keys: false)
      delete :destroy_site, params: { account_id: root_account.id }
      expect(response).to be_successful
      expect(Supports::AnthropicSetting.site).to have_attributes(api_key: nil, allow_account_keys: false)
    end

    it "works on the site admin account itself, with no school section" do
      get :show, params: { account_id: Account.site_admin.id }
      expect(response).to be_successful
      expect(json["account"]).to be_nil
      expect(json).to have_key("site")
    end

    it "logs the site change without the key" do
      lines = logged { put_site(api_key: key) }
      expect(lines.grep(/scope=site action=update user_id=#{site_admin.id}/).size).to eq 1
      expect(lines.join).not_to include(key)
    end
  end

  describe "POST test" do
    before { user_session(school_admin) }

    def stub_test(result)
      allow(Supports::AnthropicConnectionTest).to receive(:call).and_return(result)
    end

    it "tests the saved key when none is typed, and a typed key when one is" do
      put_school(api_key: "saved-key")
      stub_test(ok: true, message: "It works.")
      post :test, params: { account_id: root_account.id, scope: "account" }, as: :json
      expect(Supports::AnthropicConnectionTest).to have_received(:call).with(api_key: "saved-key", model: "claude-opus-5-5")
      expect(json).to eq("ok" => true, "message" => "It works.")

      post :test, params: { account_id: root_account.id, scope: "account", api_key: " typed-key ", model: "claude-haiku-4-5" }, as: :json
      expect(Supports::AnthropicConnectionTest).to have_received(:call).with(api_key: "typed-key", model: "claude-haiku-4-5")
    end

    it "reports a rejected key in plain words, without the key" do
      stub_test(ok: false, message: "The key was rejected.")
      post :test, params: { account_id: root_account.id, scope: "account", api_key: key }, as: :json
      expect(json).to eq("ok" => false, "message" => "The key was rejected.")
      expect(response.body).not_to include(key)
    end

    it "has nothing to test when there is no key" do
      post :test, params: { account_id: root_account.id, scope: "account" }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "limits how often it can be used" do
      enable_cache do
        stub_test(ok: true, message: "It works.")
        10.times do
          post :test, params: { account_id: root_account.id, scope: "account", api_key: key }, as: :json
          expect(response).to be_successful
        end
        post :test, params: { account_id: root_account.id, scope: "account", api_key: key }, as: :json
        expect(response).to have_http_status(:too_many_requests)
        expect(response.body).not_to include(key)
      end
    end

    it "lets a site admin test the shared key" do
      user_session(site_admin)
      stub_test(ok: true, message: "It works.")
      post :test, params: { account_id: root_account.id, scope: "site", api_key: key }, as: :json
      expect(response).to be_successful
    end
  end

  describe "GET page" do
    it "renders for a school admin with what the screen needs" do
      user_session(school_admin)
      get :page, params: { account_id: root_account.id }
      expect(response).to be_successful
      env = assigns[:js_env][:AI_SETTINGS]
      expect(env).to include(account_id: root_account.id.to_s,
                             is_site_admin_account: false,
                             can_manage_site: false,
                             default_model: "claude-opus-5-5")
      expect(env[:models].pluck(:value)).to eq Supports::AnthropicSetting::MODELS
      expect(env[:models].first).to include(label: "Claude Opus 5.5", input_price: 4, output_price: 20, context_tokens: 1_000_000)
      expect(env[:prices_checked]).to eq "2026-09-25"
      expect(assigns[:js_bundles].flatten.map(&:to_s)).to include("ai_settings")
    end

    it "tells a site admin they can manage the site's key" do
      user_session(site_admin)
      get :page, params: { account_id: Account.site_admin.id }
      expect(response).to be_successful
      expect(assigns[:js_env][:AI_SETTINGS]).to include(is_site_admin_account: true, can_manage_site: true)
    end

    it "refuses a teacher, and a sub-account is not found" do
      user_session(teacher)
      get :page, params: { account_id: root_account.id }
      expect(response).to have_http_status(:unauthorized).or have_http_status(:forbidden)
      user_session(account_admin_user(account: sub_account))
      get :page, params: { account_id: sub_account.id }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "review fixes" do
    before { user_session(school_admin) }

    it "refuses a pasted key that has a space or line break inside it" do
      put_school(api_key: "sk-ant-api03-SECRETPART\nSECONDPART-4f2a")
      expect(response).to have_http_status(:unprocessable_content)
      expect(response.body).not_to include("SECRETPART")
      expect(response.body).not_to include("SECONDPART")
      expect(Supports::AnthropicSetting.count).to eq 0
    end

    it "refuses a key that is too short" do
      put_school(api_key: "abc")
      expect(response).to have_http_status(:unprocessable_content)
      expect(Supports::AnthropicSetting.count).to eq 0
    end

    it "won't test a key that has whitespace inside it" do
      allow(Supports::AnthropicConnectionTest).to receive(:call)
      post :test, params: { account_id: root_account.id, scope: "account", api_key: "two words in a key" }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(Supports::AnthropicConnectionTest).not_to have_received(:call)
    end

    it "saves when two people save for the first time at once" do
      calls = 0
      allow(Supports::AnthropicSetting).to receive(:find_or_initialize_by).and_wrap_original do |original, *args|
        record = original.call(*args)
        calls += 1
        Supports::AnthropicSetting.create!(root_account:) if calls == 1 # the other save lands first
        record
      end
      put_school(api_key: key)
      expect(response).to be_successful
      expect(Supports::AnthropicSetting.where(root_account_id: root_account.id).count).to eq 1
      expect(Supports::AnthropicSetting.for_account(root_account).api_key).to eq key
    end

    it "ignores a blank allow_account_keys instead of failing" do
      user_session(site_admin)
      put_site(api_key: key, allow_account_keys: false)
      put_site(allow_account_keys: "")
      expect(response).to be_successful
      expect(Supports::AnthropicSetting.site.allow_account_keys).to be false
    end

    it "tells the page whether the viewer can manage this school's key" do
      get :page, params: { account_id: root_account.id }
      expect(assigns[:js_env][:AI_SETTINGS]).to include(can_manage_school: true)
      user_session(site_admin)
      get :page, params: { account_id: Account.site_admin.id }
      expect(assigns[:js_env][:AI_SETTINGS]).to include(can_manage_school: false)
    end
  end

  describe "models per feature" do
    before { user_session(school_admin) }

    it "saves a model for the IEP scan and shows what is in effect for it" do
      put_school(api_key: key, models: { iep_scan: "claude-sonnet-5-5" })
      expect(response).to be_successful
      expect(json["account"]["feature_models"]).to eq("iep_scan" => "claude-sonnet-5-5")
      expect(json["features"]).to eq [{ "key" => "iep_scan", "label" => "IEP scan", "recommended" => "claude-opus-5-5", "why" => "Most accurate on long or messy documents, and cost matters little here." }]
      expect(json["in_effect"]["features"].first).to include("feature" => "iep_scan",
                                                             "model" => "claude-sonnet-5-5",
                                                             "model_source" => "account_feature")
    end

    it "clears a feature's model, and the default model, when sent blank" do
      put_school(api_key: key, model: "claude-haiku-4-5", models: { iep_scan: "claude-sonnet-5-5" })
      put_school(model: "", models: { iep_scan: "" })
      expect(response).to be_successful
      row = Supports::AnthropicSetting.for_account(root_account)
      expect(row).to have_attributes(model: nil, feature_models: {}, api_key: key)
    end

    it "leaves models alone when none are sent" do
      put_school(api_key: key, model: "claude-haiku-4-5", models: { iep_scan: "claude-sonnet-5-5" })
      put_school(api_key: "another-key-5678")
      expect(Supports::AnthropicSetting.for_account(root_account)).to have_attributes(model: "claude-haiku-4-5", feature_models: { "iep_scan" => "claude-sonnet-5-5" })
    end

    it "refuses a model that isn't offered, for a feature, and an unknown feature" do
      put_school(models: { iep_scan: "gpt-4" })
      expect(response).to have_http_status(:unprocessable_content)
      put_school(models: { not_a_feature: "claude-haiku-4-5" })
      expect(response).to have_http_status(:unprocessable_content)
      expect(Supports::AnthropicSetting.count).to eq 0
    end

    it "keeps the policy for models out of a school admin's hands" do
      put_school(api_key: key, allow_account_models: false)
      expect(response).to be_successful
      expect(Supports::AnthropicSetting.site).to be_nil
    end

    it "says the school's models are being ignored when the site forbids them on the shared key" do
      Supports::AnthropicSetting.create!(root_account: nil, api_key: "site-key", feature_models: { "iep_scan" => "claude-haiku-4-5" }, allow_account_models: false)
      put_school(models: { iep_scan: "claude-sonnet-5-5" })
      expect(json["policy"]).to include("allow_account_models" => false)
      expect(json["in_effect"]).to include("school_models_ignored" => true)
      expect(json["in_effect"]["features"].first).to include("model" => "claude-haiku-4-5", "model_source" => "site_feature")
    end

    it "lets a site admin set the site's models and the policy" do
      user_session(site_admin)
      put_site(api_key: key, models: { iep_scan: "claude-haiku-4-5" }, allow_account_models: false)
      expect(response).to be_successful
      expect(json["site"]).to include("feature_models" => { "iep_scan" => "claude-haiku-4-5" }, "allow_account_models" => false)
      expect(response.body).not_to include(key)
      put_site(allow_account_models: "")
      expect(Supports::AnthropicSetting.site.allow_account_models).to be false
    end

    it "tells the page which features there are" do
      get :page, params: { account_id: root_account.id }
      expect(assigns[:js_env][:AI_SETTINGS][:features]).to eq [{ key: :iep_scan, label: "IEP scan", recommended: "claude-opus-5-5", why: "Most accurate on long or messy documents, and cost matters little here." }]
    end
  end

  describe "review fixes for models" do
    before { user_session(school_admin) }

    it "still saves and removes a key on a row that holds a model that is no longer offered" do
      put_school(api_key: key)
      Supports::AnthropicSetting.for_account(root_account).update_columns(model: "retired-model", feature_models: { "iep_scan" => "retired-model" })
      put_school(api_key: "sk-ant-another-key-9999")
      expect(response).to be_successful
      expect(Supports::AnthropicSetting.for_account(root_account)).to have_attributes(model: nil, feature_models: {})
      delete :destroy, params: { account_id: root_account.id }
      expect(response).to be_successful
    end

    it "tests the key on the model that would actually be used, not always Opus" do
      Supports::AnthropicSetting.create!(root_account: nil, api_key: "site-key-12345", model: "claude-sonnet-5-5")
      put_school(api_key: key)
      allow(Supports::AnthropicConnectionTest).to receive(:call).and_return(ok: true, message: "It works.")
      post :test, params: { account_id: root_account.id, scope: "account" }, as: :json
      expect(Supports::AnthropicConnectionTest).to have_received(:call).with(api_key: key, model: "claude-sonnet-5-5")
    end

    it "tests the site's key on the site's own model" do
      user_session(site_admin)
      Supports::AnthropicSetting.create!(root_account: nil, api_key: key, model: "claude-haiku-4-5")
      allow(Supports::AnthropicConnectionTest).to receive(:call).and_return(ok: true, message: "It works.")
      post :test, params: { account_id: root_account.id, scope: "site" }, as: :json
      expect(Supports::AnthropicConnectionTest).to have_received(:call).with(api_key: key, model: "claude-haiku-4-5")
    end
  end
end
