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
#

# A school's weekly teaching pattern (docs/fork-plan.md §2.3): minutes of
# instruction for each weekday, Sunday first, plus shorter or longer days on
# specific dates. Read through SchoolCalendar.
class InstructionalCalendar < ApplicationRecord
  MAX_MINUTES = 1440

  belongs_to :account
  belongs_to :root_account, class_name: "Account"

  validate :valid_minutes

  before_validation { self.root_account_id ||= account&.resolved_root_account_id }
  after_commit :replan_paced_courses, if: :saved_changes?

  # The calendar nearest to +account+: its own, or the closest parent's.
  def self.for_account(account)
    return nil unless account

    chain = Account.multi_account_chain_ids([account.id])
    by_account = where(account_id: chain).index_by(&:account_id)
    chain.lazy.filter_map { |id| by_account[id] }.first
  end

  private

  def valid_minutes
    unless weekday_minutes.is_a?(Array) && weekday_minutes.size == 7 && weekday_minutes.all? { |m| m.is_a?(Integer) && m.between?(0, MAX_MINUTES) }
      errors.add(:weekday_minutes, "must be 7 whole numbers of minutes from 0 to #{MAX_MINUTES}")
    end
    valid_dates = date_minutes.is_a?(Hash) && date_minutes.all? do |date, minutes|
      Date.iso8601(date.to_s) && minutes.is_a?(Integer) && minutes.between?(0, MAX_MINUTES)
    rescue Date::Error
      false
    end
    errors.add(:date_minutes, "must map ISO dates to minutes from 0 to #{MAX_MINUTES}") unless valid_dates
  end

  def replan_paced_courses
    SelfPaced::Pacer.replan_accounts_later([account_id])
  end
end
