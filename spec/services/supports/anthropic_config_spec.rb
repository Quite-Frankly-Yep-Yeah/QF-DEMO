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
    expect(described_class.for(root_account)).to eq(api_key: "school-key", model: "claude-sonnet-5-5", source: :account)
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
    expect(described_class.for(root_account)).to eq(api_key: "site-key", model: "claude-haiku-4-5", source: :site)
  end

  it "falls back to the server's anthropic.yml" do
    stub_file({ "api_key" => "file-key", "model" => "claude-sonnet-5-5" }.to_yaml)
    expect(described_class.for(root_account)).to eq(api_key: "file-key", model: "claude-sonnet-5-5", source: :file)
  end

  it "is nil when nothing is set up" do
    expect(described_class.for(root_account)).to be_nil
    expect(described_class.explain(root_account)).to eq(source: nil, model: nil, account_key_ignored: false)
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
end
