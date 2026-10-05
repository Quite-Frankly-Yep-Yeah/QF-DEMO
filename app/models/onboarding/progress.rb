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

# One person's mark on one onboarding step at one school: done by hand, or
# set aside. Steps the system can detect on its own (Onboarding::Tracks) need
# no row at all.
module Onboarding
  class Progress < ApplicationRecord
    self.table_name = "onboarding_progresses"

    belongs_to :root_account, class_name: "Account"
    belongs_to :user

    validates :step_key, presence: true, length: { maximum: 255 }
    validates :step_key, uniqueness: { scope: %i[user_id root_account_id] }

    scope :owned_by, ->(user, root_account) { where(user:, root_account:) }
    scope :in_track, ->(track_key) { where("step_key LIKE ?", "#{sanitize_sql_like(track_key)}.%") }
  end
end
