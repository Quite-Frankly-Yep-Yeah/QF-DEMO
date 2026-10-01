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
  # How long this teacher takes to grade, per course: the median hours from a
  # student's submission to the grade, over the last 30 days. Computed from
  # submissions, with no history table.
  module GradingTurnaround
    WINDOW = 30.days
    MEDIAN_SECONDS = "percentile_cont(0.5) WITHIN GROUP " \
                     "(ORDER BY EXTRACT(EPOCH FROM (submissions.graded_at - submissions.submitted_at)))"

    def self.for(viewer, course_ids, now: Time.zone.now)
      return {} if viewer.nil? || course_ids.empty?

      rows = Submission.joins(:assignment)
                       .where(assignments: { context_type: "Course", context_id: course_ids })
                       .where(grader_id: viewer.id, graded_at: (now - WINDOW)..now)
                       .where.not(submitted_at: nil)
                       .group("assignments.context_id")
                       .pluck(Arel.sql("assignments.context_id"), Arel.sql("COUNT(*)"), Arel.sql(MEDIAN_SECONDS))
      rows.to_h do |course_id, count, seconds|
        [course_id, { median_hours: (seconds / 3600.0).round(1), graded_count: count }]
      end
    end
  end
end
