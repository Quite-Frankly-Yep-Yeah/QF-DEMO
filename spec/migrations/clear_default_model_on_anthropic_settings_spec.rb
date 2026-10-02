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

require Rails.root.join("db/migrate/20261002130000_clear_default_model_on_anthropic_settings")

describe ClearDefaultModelOnAnthropicSettings do
  let_once(:root_account) { Account.default }

  it "clears the Opus that older rows got only because it used to be the column default" do
    site = Supports::AnthropicSetting.create!(root_account: nil)
    school = Supports::AnthropicSetting.create!(root_account:)
    site.update_columns(model: "claude-opus-5-5")
    school.update_columns(model: "claude-opus-5-5")
    Supports::AnthropicSetting.create!(root_account: Account.create!(name: "Other"), model: "claude-haiku-4-5")

    described_class.new.suppress_messages { described_class.new.up }

    expect(site.reload.model).to be_nil
    expect(school.reload.model).to be_nil
    expect(Supports::AnthropicSetting.where(model: "claude-haiku-4-5").count).to eq 1
  end
end
