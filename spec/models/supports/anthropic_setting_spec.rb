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

describe Supports::AnthropicSetting do
  let_once(:root_account) { Account.default }

  def raw(column, id)
    described_class.connection.select_value("SELECT #{column} FROM #{described_class.quoted_table_name} WHERE id = #{id}")
  end

  it "keeps the key encrypted at rest and remembers only its last four characters" do
    setting = described_class.create!(root_account:, api_key: "sk-ant-secret-4f2a")
    expect(setting.reload.api_key).to eq "sk-ant-secret-4f2a"
    expect(setting.key_last4).to eq "4f2a"
    expect(raw("api_key", setting.id)).not_to include("sk-ant-secret")
  end

  it "forgets the last four when the key is removed" do
    setting = described_class.create!(root_account:, api_key: "sk-ant-secret-4f2a")
    setting.update!(api_key: nil)
    expect(setting.reload).to have_attributes(api_key: nil, key_last4: nil)
    expect(setting).not_to be_key
  end

  it "starts with no model chosen, policies on, and only allows the offered models" do
    setting = described_class.new(root_account:)
    expect(setting).to have_attributes(model: nil, allow_account_keys: true, allow_account_models: true, feature_models: {})
    expect(setting).to be_valid
    expect(described_class::MODELS).to eq %w[claude-opus-5-5 claude-sonnet-5-5 claude-haiku-4-5]
    expect(described_class::DEFAULT_MODEL).to eq "claude-opus-5-5"
    setting.model = "gpt-4"
    expect(setting).not_to be_valid
  end

  it "treats a blank model as none chosen" do
    expect(described_class.new(root_account:, model: "").model).to be_nil
  end

  it "keeps a model per feature, drops blank ones, and refuses an unknown feature or model" do
    setting = described_class.new(root_account:, feature_models: { iep_scan: "claude-haiku-4-5", other: "" })
    expect(setting.feature_models).to eq("iep_scan" => "claude-haiku-4-5")
    expect(setting).to be_valid

    expect(described_class.new(root_account:, feature_models: { "not_a_feature" => "claude-haiku-4-5" })).not_to be_valid
    expect(described_class.new(root_account:, feature_models: { "iep_scan" => "gpt-4" })).not_to be_valid
  end

  it "has one row per school and one site-wide row" do
    described_class.create!(root_account:)
    expect(described_class.new(root_account:)).not_to be_valid
    expect { described_class.new(root_account:).save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)

    described_class.create!(root_account: nil)
    expect(described_class.new(root_account: nil)).not_to be_valid
    expect { described_class.new(root_account: nil).save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "finds the site row and a school's row" do
    expect(described_class.site).to be_nil
    site = described_class.create!(root_account: nil)
    school = described_class.create!(root_account:)
    expect(described_class.site).to eq site
    expect(described_class.for_account(root_account)).to eq school
  end

  it "refuses a key with a space or line break inside it, without echoing it" do
    setting = described_class.new(root_account:, api_key: "sk-ant-api03-ABC\nDEF-4f2a")
    expect(setting).not_to be_valid
    expect(setting.errors.full_messages.join).not_to include("ABC")
    expect(described_class.new(root_account:, api_key: "sk-ant-api03-ABC DEF-4f2a")).not_to be_valid
  end

  it "refuses a key too short to be real, so its last four aren't most of it" do
    expect(described_class.new(root_account:, api_key: "abcd1234")).to be_valid
    expect(described_class.new(root_account:, api_key: "abc1234")).not_to be_valid
  end

  it "describes what is wrong with a typed key" do
    expect(described_class.key_problems("sk-ant-fine-key-1234")).to eq []
    expect(described_class.key_problems("two words here")).to include(/spaces or line breaks/)
    expect(described_class.key_problems("short")).to include(/too short/)
  end

  describe "a model that is no longer offered" do
    let(:row) do
      described_class.create!(root_account:, api_key: "sk-ant-first-key-1234").tap do |setting|
        setting.update_columns(model: "retired-model", feature_models: { "iep_scan" => "retired-model", "gone_feature" => "claude-haiku-4-5" })
      end
    end

    it "doesn't stop the row from being saved, and drops the stale choices" do
      row.update!(api_key: "sk-ant-second-key-5678")
      expect(row.reload).to have_attributes(api_key: "sk-ant-second-key-5678", model: nil, feature_models: {})
    end

    it "still refuses a new choice that isn't offered" do
      row.model = "gpt-4"
      expect(row).not_to be_valid
      row.model = nil
      row.feature_models = { "iep_scan" => "gpt-4" }
      expect(row).not_to be_valid
    end
  end
end
