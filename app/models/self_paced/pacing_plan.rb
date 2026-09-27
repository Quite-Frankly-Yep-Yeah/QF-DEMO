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

# One student's pacing plan in one course (docs/fork-plan.md §2.3). Built and
# kept up to date by SelfPaced::Pacer.
#
# baseline: { "days" => [[date, fraction of all work planned by then]],
#             "total_minutes" => n }
# current:  { "from" => date, "items" => [[tag_id, date, minutes]],
#             "days" => [[date, remaining work planned by then]],
#             "daily_minutes" => n, "done_minutes" => n, "total_minutes" => n }
module SelfPaced
  class PacingPlan < ApplicationRecord
    self.table_name = "pacing_plans"

    TARGET_SOURCES = %w[default teacher].freeze

    belongs_to :user
    belongs_to :course
    belongs_to :root_account, class_name: "Account"
    belongs_to :target_set_by, class_name: "User", optional: true

    validates :target_source, inclusion: { in: TARGET_SOURCES }
    validate :target_not_before_start

    before_validation { self.root_account_id ||= course&.root_account_id }

    # {tag_id => Date} from the current plan.
    def planned_dates
      @planned_dates ||= Array(current["items"]).to_h { |id, date, _| [id.to_i, Date.iso8601(date)] }
    end

    def reload(*)
      @planned_dates = nil
      super
    end

    private

    def target_not_before_start
      errors.add(:target_date, "can't be before the start date") if start_date && target_date && target_date < start_date
    end
  end
end
