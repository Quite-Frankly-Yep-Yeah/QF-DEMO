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
    # or TA enrollment, or as an admin of the course's account), with the
    # students they may see in each. Section-limited TAs only see their own
    # sections. Courses without the queue flag are left out.
    class Courses
      Entry = Struct.new(:course, :student_ids, keyword_init: true)

      def self.for(viewer)
        new(viewer).entries
      end

      def initialize(viewer)
        @viewer = viewer
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

      # Courses the viewer teaches or assists in, plus every course in an
      # account they administer. manage_grades (above) decides which of them
      # they may actually grade.
      def courses
        taught = @viewer.enrollments.active_or_pending
                        .where(type: TeacherWorkflow::GRADER_TYPES)
                        .joins(:course).merge(Course.active)
                        .select(:course_id)
        administered = CourseAccountAssociation.where(account_id: admin_account_ids).select(:course_id)
        Course.active.where(id: taught).or(Course.active.where(id: administered))
              .preload(:root_account, :account).to_a
      end

      def admin_account_ids
        AccountUser.active.where(user_id: @viewer.id).pluck(:account_id)
      end
    end
  end
end
