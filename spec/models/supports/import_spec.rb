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

describe Supports::Import do
  let_once(:account) { Account.default }
  let_once(:admin) { account_admin_user(account:) }
  let_once(:student) { user_factory(active_all: true, name: "Pat Student") }

  def scan_import(**attrs)
    described_class.new({ account:, user: admin, student:, format: "iep_scan", extraction_state: "queued" }.merge(attrs))
  end

  it "is a valid scan import for a student" do
    expect(scan_import).to be_valid
    expect(scan_import).to be_scan
  end

  it "isn't a scan when it is a CSV import" do
    expect(described_class.new(account:, user: admin)).not_to be_scan
  end

  it "rejects an unknown extraction state" do
    expect(scan_import(extraction_state: "halfway")).not_to be_valid
  end

  it "allows no extraction state for a CSV import" do
    expect(described_class.new(account:, user: admin)).to be_valid
  end

  it "keeps the extraction as a hash, encrypted at rest" do
    import = scan_import(extraction: { "items" => [{ "source_quote" => "SECRET-QUOTE" }] })
    import.save!
    expect(import.reload.extraction).to eq("items" => [{ "source_quote" => "SECRET-QUOTE" }])
    raw = described_class.connection.select_value("SELECT extraction FROM #{described_class.quoted_table_name} WHERE id = #{import.id}")
    expect(raw).not_to include("SECRET-QUOTE")
  end

  it "keeps the document encrypted at rest" do
    import = scan_import(data: Base64.strict_encode64("SECRET-DOC"), content_type: "application/pdf")
    import.save!
    raw = described_class.connection.select_value("SELECT data FROM #{described_class.quoted_table_name} WHERE id = #{import.id}")
    expect(raw).not_to include(Base64.strict_encode64("SECRET-DOC"))
  end

  it "can point at the plan it created" do
    plan = Supports::Plan.create!(account:, student:, plan_type: "iep", source: "scan")
    import = scan_import(plan:)
    expect(import).to be_valid
    expect(plan.source).to eq "scan"
  end
end
