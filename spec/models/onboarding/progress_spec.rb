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

describe Onboarding::Progress do
  let_once(:root_account) { Account.default }
  let_once(:user) { user_factory }

  it "keeps one row per person, school and step" do
    described_class.create!(user:, root_account:, step_key: "install.mail", completed_at: Time.zone.now)
    duplicate = described_class.new(user:, root_account:, step_key: "install.mail")
    expect(duplicate).not_to be_valid
  end

  it "finds a track's rows by their key prefix, and only that track's" do
    described_class.create!(user:, root_account:, step_key: "install.mail", completed_at: Time.zone.now)
    described_class.create!(user:, root_account:, step_key: "installer.mail", completed_at: Time.zone.now)
    described_class.create!(user:, root_account:, step_key: "teacher.dashboard", completed_at: Time.zone.now)
    expect(described_class.owned_by(user, root_account).in_track("install").pluck(:step_key)).to eq ["install.mail"]
  end
end
