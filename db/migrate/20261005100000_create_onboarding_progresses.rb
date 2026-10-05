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

class CreateOnboardingProgresses < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :onboarding_progresses do |t|
      t.references :root_account, foreign_key: { to_table: :accounts }, index: false, null: false
      t.references :user, foreign_key: true, index: false, null: false
      # "<track>.<step>", e.g. "install.mail"
      t.string :step_key, null: false, limit: 255
      t.datetime :completed_at
      t.datetime :dismissed_at
      t.timestamps

      t.index %i[user_id root_account_id step_key],
              unique: true,
              name: "index_onboarding_progresses_on_user_account_step"
      t.index :root_account_id
      t.replica_identity_index
    end
  end
end
