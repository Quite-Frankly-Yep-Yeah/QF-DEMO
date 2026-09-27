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

# A teacher saying "I have read this" about one version of a student's
# accommodations (docs/teacher-workflow-plan.md §2.3). A new version of the
# plan needs a new acknowledgement.
module Supports
  class Acknowledgement < ApplicationRecord
    self.table_name = "accommodation_acknowledgements"

    belongs_to :root_account, class_name: "Account"
    belongs_to :plan, class_name: "Supports::Plan", foreign_key: :support_plan_id, inverse_of: :acknowledgements
    belongs_to :user

    def readonly?
      persisted?
    end

    def self.record!(plan, user)
      insert_all([{ root_account_id: plan.root_account_id,
                    support_plan_id: plan.id,
                    plan_version: plan.version,
                    user_id: user.id,
                    created_at: Time.now.utc }])
    end

    def self.acknowledged?(plan, user)
      where(plan:, plan_version: plan.version, user:).exists?
    end
  end
end
