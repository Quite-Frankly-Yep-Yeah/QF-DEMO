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

# The accommodations card a teacher sees for a student
# (docs/teacher-workflow-plan.md §2.3): the accommodations in effect, and
# whether the teacher has acknowledged the current list. Tier 1 only: no plan
# type, dates or goals. A teacher only sees accommodations for the courses
# they teach the student in.
module Supports
  class AccommodationCard
    def initialize(viewer, student, root_account, real_user: nil)
      @viewer = viewer
      @student = student
      @root_account = root_account
      @real_user = real_user
      @access = Access.new(viewer, student, root_account)
    end

    # nil when the viewer may not see the student's accommodations. Logs the
    # read otherwise.
    def as_json
      return nil unless @access.view!(:accommodations, subject: :accommodations, real_user: @real_user)

      rows = accommodations
      course_names = Course.where(id: rows.flat_map(&:course_ids).uniq).pluck(:id, :name).to_h
      {
        student: { id: @student.id.to_s, name: @student.name },
        accommodations: rows.map { |row| row.teacher_json(course_names) },
        acknowledged: acknowledged?(rows),
        can_manage: @access.can_manage?
      }
    end

    # Records "I have read this" for every plan behind the accommodations the
    # viewer can see.
    def acknowledge!
      return false unless @access.view!(:accommodations, subject: :acknowledgement, real_user: @real_user)

      accommodations.map(&:plan).uniq.each { |plan| Acknowledgement.record!(plan, @viewer) }
      true
    end

    def accommodations
      @accommodations ||= begin
        rows = StudentAccommodation.current.where(student: @student, root_account: @root_account)
                                   .preload(:accommodation_type, :plan)
                                   .sort_by { |row| [row.accommodation_type.position, row.accommodation_type.name] }
        if @access.teacher_only?
          taught = @access.taught_course_ids
          rows = rows.select { |row| row.all_courses? || row.course_ids.intersect?(taught) }
        end
        rows
      end
    end

    private

    def acknowledged?(rows)
      plans = rows.map(&:plan).uniq
      plans.all? { |plan| Acknowledgement.acknowledged?(plan, @viewer) }
    end
  end
end
