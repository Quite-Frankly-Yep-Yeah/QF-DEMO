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

# How long a module item should take, in minutes, when the teacher hasn't set
# an estimate (docs/fork-plan.md §2.3): reading time for pages, a few minutes
# per question for quizzes, and flat defaults for everything else.
module SelfPaced
  module Estimator
    WORDS_PER_MINUTE = 150
    MINUTES_PER_QUESTION = 3
    FLAT_MINUTES = {
      "Assignment" => 30,
      "DiscussionTopic" => 20,
      "ContextExternalTool" => 15,
      "ExternalUrl" => 15,
      "Attachment" => 10
    }.freeze
    OTHER_MINUTES = 10

    class << self
      # Uses +setting+'s estimate when there is one. Expects tag.content to be
      # loaded for pages and quizzes.
      def minutes(tag, setting = nil)
        return setting.estimated_minutes if setting&.estimated_minutes
        return 0 if setting&.role == "none"

        case tag.content_type
        when "WikiPage" then page_minutes(tag.content)
        when "Quizzes::Quiz" then (tag.content&.question_count.to_i * MINUTES_PER_QUESTION).clamp(10, 90)
        else FLAT_MINUTES.fetch(tag.content_type, OTHER_MINUTES)
        end
      end

      private

      def page_minutes(page)
        words = Nokogiri::HTML5.fragment(page&.body.to_s).text.split.size
        ((words.to_f / WORDS_PER_MINUTE).ceil + 2).clamp(5, 60)
      end
    end
  end
end
