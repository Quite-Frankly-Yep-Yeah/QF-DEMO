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

describe Supports::ScanBatch do
  let_once(:account) { Account.default }
  let_once(:admin) { account_admin_user(account:) }

  it "is valid with its owners and starts with no scans" do
    batch = described_class.create!(root_account: account, account:, user: admin)
    expect(batch.imports).to eq []
  end

  it "needs an account and a user, and takes its root account from the account" do
    expect(described_class.new(root_account: account, user: admin)).not_to be_valid
    expect(described_class.new(root_account: account, account:)).not_to be_valid
    expect(described_class.new(account:, user: admin)).to be_valid
    expect(described_class.create!(account:, user: admin).root_account).to eq account
  end

  it "has the scans uploaded with it" do
    batch = described_class.create!(root_account: account, account:, user: admin)
    import = Supports::Import.create!(account:, user: admin, format: "iep_scan", extraction_state: "queued", batch:)
    expect(batch.imports).to eq [import]
    expect(import.reload.batch).to eq batch
  end

  it "keeps no student data of its own" do
    expect(described_class.column_names).to match_array %w[id root_account_id account_id user_id created_at updated_at]
  end
end
