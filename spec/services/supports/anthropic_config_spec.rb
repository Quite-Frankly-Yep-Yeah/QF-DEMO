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

describe Supports::AnthropicConfig do
  let_once(:root_account) { Account.default }

  def school(**attrs)
    Supports::AnthropicSetting.create!({ root_account: }.merge(attrs))
  end

  def site(**attrs)
    Supports::AnthropicSetting.create!({ root_account: nil }.merge(attrs))
  end

  def stub_file(yaml)
    allow(DynamicSettings).to receive(:find).and_call_original
    allow(DynamicSettings).to receive(:find).with(tree: :private).and_return("anthropic.yml" => yaml)
  end

  before { stub_file(nil) }

  it "uses the school's own key first" do
    school(api_key: "school-key", model: "claude-sonnet-5-5")
    site(api_key: "site-key")
    expect(described_class.for(root_account)).to include(api_key: "school-key", model: "claude-sonnet-5-5", source: :account)
  end

  it "ignores the school's key when the site forbids it, and uses it again when allowed" do
    school(api_key: "school-key")
    site_row = site(api_key: "site-key", allow_account_keys: false)
    expect(described_class.for(root_account)).to include(api_key: "site-key", source: :site)
    expect(described_class.explain(root_account)).to include(source: :site, account_key_ignored: true)

    site_row.update!(allow_account_keys: true)
    expect(described_class.for(root_account)).to include(api_key: "school-key", source: :account)
    expect(described_class.explain(root_account)).to include(source: :account, account_key_ignored: false)
  end

  it "uses the site key when the school has none" do
    school
    site(api_key: "site-key", model: "claude-haiku-4-5")
    expect(described_class.for(root_account)).to include(api_key: "site-key", model: "claude-haiku-4-5", source: :site)
  end

  it "falls back to the server's anthropic.yml" do
    stub_file({ "api_key" => "file-key", "model" => "claude-sonnet-5-5" }.to_yaml)
    expect(described_class.for(root_account)).to include(api_key: "file-key", model: "claude-sonnet-5-5", source: :file)
  end

  it "is nil when nothing is set up" do
    expect(described_class.for(root_account)).to be_nil
    expect(described_class.explain(root_account)).to include(source: nil, model: nil, model_source: nil, account_key_ignored: false, school_models_ignored: false)
  end

  it "falls back to the default model when a stored or configured one isn't offered" do
    stub_file({ "api_key" => "file-key", "model" => "gpt-4" }.to_yaml)
    expect(described_class.for(root_account)[:model]).to eq "claude-opus-5-5"
    school(api_key: "school-key").update_columns(model: "retired-model")
    expect(described_class.for(root_account)).to include(source: :account, model: "claude-opus-5-5")
  end

  it "doesn't count a school row that has no key" do
    school(api_key: nil)
    expect(described_class.for(root_account)).to be_nil
  end

  describe "which model a feature uses" do
    def model_for(feature = :iep_scan)
      described_class.for(root_account, feature:)
    end

    it "takes the school's choice for the feature first, then each next level in turn" do
      stub_file({ "api_key" => "file-key", "model" => "claude-sonnet-5-5" }.to_yaml)
      school_row = school(api_key: "school-key", model: "claude-haiku-4-5", feature_models: { "iep_scan" => "claude-opus-5-5" })
      site_row = site(api_key: "site-key", model: "claude-sonnet-5-5", feature_models: { "iep_scan" => "claude-haiku-4-5" })
      expect(model_for).to include(model: "claude-opus-5-5", model_source: :account_feature)

      school_row.update!(feature_models: {})
      expect(model_for).to include(model: "claude-haiku-4-5", model_source: :account_default)

      school_row.update!(model: nil)
      expect(model_for).to include(model: "claude-haiku-4-5", model_source: :site_feature)

      site_row.update!(feature_models: {})
      expect(model_for).to include(model: "claude-sonnet-5-5", model_source: :site_default)

      site_row.update!(model: nil)
      expect(model_for).to include(model: "claude-sonnet-5-5", model_source: :file)

      stub_file(nil)
      expect(model_for).to include(model: "claude-opus-5-5", model_source: :default)
    end

    it "lets a school that uses the shared key choose its own model while the site allows it" do
      school(model: "claude-haiku-4-5", feature_models: { "iep_scan" => "claude-sonnet-5-5" })
      site(api_key: "site-key", model: "claude-opus-5-5")
      expect(model_for).to include(api_key: "site-key", source: :site, model: "claude-sonnet-5-5", model_source: :account_feature)
    end

    it "ignores the school's models on the shared key when the site forbids it, and says so" do
      school(feature_models: { "iep_scan" => "claude-sonnet-5-5" })
      site(api_key: "site-key", model: "claude-opus-5-5", feature_models: { "iep_scan" => "claude-haiku-4-5" }, allow_account_models: false)
      expect(model_for).to include(model: "claude-haiku-4-5", model_source: :site_feature)
      expect(described_class.explain(root_account)).to include(school_models_ignored: true)
    end

    it "always honours the school's models when it uses its own key, whatever the site policy says" do
      school(api_key: "school-key", feature_models: { "iep_scan" => "claude-sonnet-5-5" })
      site(api_key: "site-key", allow_account_models: false)
      expect(model_for).to include(source: :account, model: "claude-sonnet-5-5")
      expect(described_class.explain(root_account)).to include(school_models_ignored: false)
    end

    it "lets a school that has chosen nothing follow the site's choice, not an untouched default" do
      school(api_key: "school-key")
      site(api_key: "site-key", feature_models: { "iep_scan" => "claude-haiku-4-5" })
      expect(model_for).to include(model: "claude-haiku-4-5", model_source: :site_feature)
    end

    it "ignores feature choices when no feature is asked about" do
      school(api_key: "school-key", model: "claude-sonnet-5-5", feature_models: { "iep_scan" => "claude-haiku-4-5" })
      expect(described_class.for(root_account)).to include(model: "claude-sonnet-5-5", model_source: :account_default)
    end

    it "skips a stored model that isn't offered any more" do
      row = school(api_key: "school-key", model: "claude-sonnet-5-5")
      row.update_columns(feature_models: { "iep_scan" => "retired-model" })
      expect(model_for).to include(model: "claude-sonnet-5-5", model_source: :account_default)
    end

    it "says what each feature uses" do
      school(api_key: "school-key", feature_models: { "iep_scan" => "claude-haiku-4-5" })
      expect(described_class.explain(root_account)[:features])
        .to eq [{ feature: :iep_scan, label: "IEP scan", model: "claude-haiku-4-5", model_source: :account_feature }]
    end
  end

  it "says why the default model is what it is" do
    school(api_key: "school-key", model: "claude-sonnet-5-5")
    expect(described_class.explain(root_account)).to include(model: "claude-sonnet-5-5", model_source: :account_default)
  end
end
