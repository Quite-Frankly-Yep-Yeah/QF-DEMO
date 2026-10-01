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
    # The courses a viewer may grade (manage_grades through an active teacher
    # or TA enrollment, or admin rights on a course they name), with the
    # students they may see in each. Section-limited TAs only see their own
    # sections. Courses without the queue flag are left out.
    class Courses
      Entry = Struct.new(:course, :student_ids, keyword_init: true)

      def self.for(viewer, course_id: nil)
        new(viewer, course_id:).entries
      end

      def initialize(viewer, course_id: nil)
        @viewer = viewer
        @course_id = course_id
      end

      def entries
        return [] unless @viewer

        courses.filter_map do |course|
          next unless TeacherWorkflow.feature_enabled?(course, :workflow_grading_queue)
          next unless course.grants_right?(@viewer, :manage_grades)

          Entry.new(course:, student_ids: course.students_visible_to(@viewer).pluck(:id))
        end
      end

      private

      def courses
        ids = @viewer.enrollments.active_or_pending
                     .where(type: TeacherWorkflow::GRADER_TYPES)
                     .joins(:course).merge(Course.active)
                     .pluck(:course_id)
        # naming a course lets an admin who doesn't teach it ask for it;
        # manage_grades below decides whether they may
        ids = [@course_id.to_i] if @course_id.present?
        Course.where(id: ids).preload(:root_account, :account).to_a
      end
    end
  end
end
