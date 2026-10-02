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

  it "defaults to the default model, lets policy default on, and only allows the offered models" do
    setting = described_class.new(root_account:)
    expect(setting).to have_attributes(model: "claude-opus-5-5", allow_account_keys: true)
    expect(described_class::MODELS).to eq %w[claude-opus-5-5 claude-sonnet-5-5 claude-haiku-4-5]
    setting.model = "gpt-4"
    expect(setting).not_to be_valid
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
end
