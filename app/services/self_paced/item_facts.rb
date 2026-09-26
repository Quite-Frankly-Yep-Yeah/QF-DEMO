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

# Small questions about a module item's content that the intervention tools
# ask (docs/fork-plan.md §2.5).
module SelfPaced
  module ItemFacts
    class << self
      # The assignment behind an item when it counts toward the grade.
      def graded_assignment(content)
        assignment = content.is_a?(Assignment) ? content : content.try(:assignment)
        return nil unless assignment&.published? && assignment.grading_type != "not_graded"

        assignment
      end

      # Whether the item has a limited number of tries staff can add to.
      def attempts_limited?(content)
        (content.is_a?(Quizzes::Quiz) || content.is_a?(Assignment)) && content.allowed_attempts.to_i.positive?
      end

      # The assignment whose submissions record tries on the item.
      def assignment_id(content)
        case content
        when Assignment then content.id
        when Quizzes::Quiz, DiscussionTopic then content.assignment_id
        end
      end
    end
  end
end
