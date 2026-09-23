# frozen_string_literal: true

#
# Copyright (C) 2026 - present EXAMPLE contributors
#
# This file is part of EXAMPLE LMS, a modified version of Canvas.
#
# EXAMPLE LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

# How the course player treats one module item (docs/fork-plan.md §2.1).
module SelfPaced
  class ItemSetting < ApplicationRecord
    self.table_name = "module_item_settings"

    ROLES = %w[instruction practice check pretest none].freeze

    belongs_to :content_tag
    belongs_to :course
    belongs_to :root_account, class_name: "Account"

    validates :role, inclusion: { in: ROLES }
    validates :mastery_threshold, numericality: { greater_than: 0, less_than_or_equal_to: 100 }, allow_nil: true
    validates :watch_fraction, numericality: { greater_than: 0, less_than_or_equal_to: 1 }, allow_nil: true
    validates :max_attempts, numericality: { greater_than: 0, only_integer: true }, allow_nil: true

    before_validation { self.root_account_id ||= course&.root_account_id }

    # The role a module item gets before a teacher changes it. (Not
    # "default_role": ActiveRecord uses that name to pick a database role.)
    def self.suggested_role(tag)
      case tag.content_type
      when "ContextModuleSubHeader" then "none"
      when "Quizzes::Quiz" then "check"
      when "Assignment", "DiscussionTopic" then "practice"
      else "instruction"
      end
    end
  end
end
