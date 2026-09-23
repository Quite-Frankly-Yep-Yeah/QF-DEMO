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

# Works out which module item a student is looking at, from the
# module_item_id query parameter (present when they came from the modules page
# or the next/previous buttons) or, failing that, from the page's path.
module SelfPaced
  class ContentTagResolver
    PATH_CONTENT_TYPES = {
      "pages" => "WikiPage",
      "assignments" => "Assignment",
      "quizzes" => "Quizzes::Quiz",
      "discussion_topics" => "DiscussionTopic",
      "files" => "Attachment"
    }.freeze

    def self.resolve(course, module_item_id: nil, path: nil)
      new(course).resolve(module_item_id:, path:)
    end

    def initialize(course)
      @course = course
    end

    def resolve(module_item_id:, path:)
      from_module_item_id(module_item_id) || from_path(path)
    end

    private

    def tags
      @course.context_module_tags.not_deleted
    end

    def from_module_item_id(module_item_id)
      id = Integer(module_item_id.to_s, exception: false)
      id && tags.find_by(id:)
    end

    def from_path(path)
      match = %r{\A/courses/#{@course.id}/(#{PATH_CONTENT_TYPES.keys.join("|")})/([^/?#]+)}.match(path.to_s)
      return unless match

      content_type = PATH_CONTENT_TYPES[match[1]]
      content_id = if content_type == "WikiPage"
                     @course.wiki_pages.not_deleted.where(url: CGI.unescape(match[2])).pick(:id)
                   else
                     Integer(match[2], exception: false)
                   end
      content_id && tags.where(content_type:, content_id:).first
    end
  end
end
