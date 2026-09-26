# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

require_relative "../views_helper"

describe "shared/_account_options" do
  before :once do
    @root_account = Account.create!(name: "Root Account")

    @sub_account1 = @root_account.sub_accounts.create!(name: "Sub Account 1")
    @sub_account2 = @root_account.sub_accounts.create!(name: "Sub Account 2")

    @nested_sub_account1 = @sub_account1.sub_accounts.create!(name: "Nested Sub Account 1")
    @nested_sub_account2 = @sub_account2.sub_accounts.create!(name: "Nested Sub Account 2")

    assign(:account, @root_account)
  end

  it "renders all sub-accounts in hierarchical order" do
    render partial: "shared/account_options", locals: { account: @root_account }

    html = Nokogiri::HTML5.fragment(response.body)
    options = html.css("option")

    expect(options.map { |o| [o.text.gsub(/[\u00A0\s]+/, " ").strip, o["value"].to_i] }).to eq [
      ["Root Account", @root_account.id],
      ["Sub Account 1", @sub_account1.id],
      ["Nested Sub Account 1", @nested_sub_account1.id],
      ["Sub Account 2", @sub_account2.id],
      ["Nested Sub Account 2", @nested_sub_account2.id]
    ]
  end

  it "selects the current account when @context is set" do
    assign(:context, instance_double(Course, account_id: @nested_sub_account1.id))

    render partial: "shared/account_options", locals: { account: @root_account }

    html = Nokogiri::HTML5.fragment(response.body)
    selected_option = html.css("option[selected]").first

    expect(selected_option).to be_present
    expect(selected_option["value"].to_i).to eq @nested_sub_account1.id
  end

  it "handles accounts with no sub-accounts" do
    empty_account = Account.create!(name: "Empty Account")

    render partial: "shared/account_options", locals: { account: empty_account }

    html = Nokogiri::HTML5.fragment(response.body)
    options = html.css("option")

    expect(options.map { |o| [o.text.strip, o["value"].to_i] }).to eq [
      ["Empty Account", empty_account.id]
    ]
  end

  context "with deleted sub-accounts" do
    before do
      @deleted_account = @root_account.sub_accounts.create!(name: "Deleted Account")
      @deleted_account.update(workflow_state: "deleted", deleted_at: Time.zone.now)
    end

    it "does not include deleted accounts" do
      render partial: "shared/account_options", locals: { account: @root_account }

      html = Nokogiri::HTML5.fragment(response.body)
      options = html.css("option")

      deleted_account_option = options.find { |o| o["value"].to_i == @deleted_account.id }
      expect(deleted_account_option).to be_nil
    end
  end
end
