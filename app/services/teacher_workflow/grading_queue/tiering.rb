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

module TeacherWorkflow
  class GradingQueue
    # Which of the four tiers a waiting submission belongs to
    # (docs/superpowers/specs/2026-10-01-grading-queue-design.md). Pure: it
    # only looks at what it is given.
    module Tiering
      BLOCKED = 1
      COULD_RELOCK = 2
      DUE_SOON = 3
      OTHER = 4

      DUE_SOON_WINDOW = 72.hours

      def self.call(due_at:, item:, current_item:, player:, provisional:, now:)
        if player && item&.grade_requirement && current_item
          return BLOCKED if !provisional && current_item.unit_id == item.unit_id && current_item.order == item.order
          return COULD_RELOCK if provisional && (current_item.order <=> item.order) == 1
        end
        return DUE_SOON if due_at && due_at <= now + DUE_SOON_WINDOW

        OTHER
      end
    end
  end
end
