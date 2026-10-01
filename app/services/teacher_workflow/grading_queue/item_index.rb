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
    # Maps a course's assignments to their module items, built once per course
    # per request. A quiz or graded discussion is found through the assignment
    # it owns. Items outside any module map to nil.
    class ItemIndex
      Item = Struct.new(:tag, :unit_id, :unit_name, :order, :grade_requirement, keyword_init: true)

      GRADE_REQUIREMENTS = %w[min_percentage min_score].freeze

      def initialize(course)
        @course = course
      end

      def for_assignment(assignment)
        by_assignment_id[assignment.id]
      end

      # The item for a ContentTag id (used for the student's current item).
      def for_tag_id(tag_id)
        items_by_tag_id[tag_id]
      end

      private

      def items_by_tag_id
        @items_by_tag_id ||= tags.index_by(&:id).transform_values { |tag| build(tag) }
      end

      def by_assignment_id
        @by_assignment_id ||= begin
          quiz_assignments = Quizzes::Quiz.where(id: ids_of("Quizzes::Quiz")).pluck(:id, :assignment_id).to_h
          topic_assignments = DiscussionTopic.where(id: ids_of("DiscussionTopic")).pluck(:id, :assignment_id).to_h
          tags.each_with_object({}) do |tag, map|
            assignment_id = case tag.content_type
                            when "Assignment" then tag.content_id
                            when "Quizzes::Quiz" then quiz_assignments[tag.content_id]
                            when "DiscussionTopic" then topic_assignments[tag.content_id]
                            end
            map[assignment_id] ||= items_by_tag_id[tag.id] if assignment_id
          end
        end
      end

      def tags
        @tags ||= @course.context_module_tags.not_deleted.preload(:context_module).to_a
      end

      def ids_of(content_type)
        tags.select { |tag| tag.content_type == content_type }.map(&:content_id)
      end

      def build(tag)
        context_module = tag.context_module
        requirement = Array(context_module.completion_requirements).find { |r| r[:id].to_i == tag.id }
        Item.new(tag:,
                 unit_id: context_module.id,
                 unit_name: context_module.name,
                 order: [context_module.position.to_i, tag.position.to_i],
                 grade_requirement: GRADE_REQUIREMENTS.include?(requirement&.dig(:type).to_s))
      end
    end
  end
end
