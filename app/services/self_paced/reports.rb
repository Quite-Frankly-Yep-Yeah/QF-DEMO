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

# The self-paced CSV reports (docs/fork-plan.md Phase 7), for the courses a
# person can see: progress, time on task, pacing, the intervention log and
# engaged days. Used for teacher and mentor exports (through their
# DashboardScope) and for the admin report family.
module SelfPaced
  class Reports
    KINDS = %w[progress time_on_task pacing interventions engaged_days].freeze

    HEADERS = {
      "progress" => ["course id",
                     "course",
                     "student id",
                     "student",
                     "percent complete",
                     "requirements completed",
                     "requirements total",
                     "current item",
                     "grade",
                     "last active"],
      "time_on_task" => ["course id",
                         "course",
                         "student id",
                         "student",
                         "active minutes",
                         "days active",
                         "submissions",
                         "last active day"],
      "pacing" => ["course id",
                   "course",
                   "student id",
                   "student",
                   "percent complete",
                   "expected percent",
                   "days behind",
                   "target date"],
      "interventions" => ["date", "course id", "course", "student id", "student", "action", "item", "by", "reason"],
      "engaged_days" => ["course id",
                         "course",
                         "student id",
                         "student",
                         "days engaged",
                         "days with activity",
                         "days corrected by staff",
                         "active minutes"]
    }.freeze

    # +courses+: the courses to report on. +grades+: a callable that says
    # which grade to show for a course: :unposted, :posted, or nil for none.
    def initialize(courses, from:, to:, grades: ->(_course) { :unposted })
      @courses = courses
      @from = from
      @to = to
      @grades = grades
    end

    def self.valid_kind?(kind)
      KINDS.include?(kind)
    end

    def headers(kind)
      raise ArgumentError, "unknown report: #{kind}" unless self.class.valid_kind?(kind)

      HEADERS.fetch(kind)
    end

    # Yields one array per row, in the order of headers(kind).
    def each_row(kind, &)
      raise ArgumentError, "unknown report: #{kind}" unless self.class.valid_kind?(kind)

      @courses.each { |course| send(:"rows_for_#{kind}", course, &) }
    end

    def to_csv(kind)
      CSV.generate do |csv|
        csv << headers(kind)
        each_row(kind) { |row| csv << row }
      end
    end

    private

    def states(course)
      StudentCourseState.where(course:).preload(:user, :current_content_tag).sort_by { |state| state.user.sortable_name.to_s }
    end

    def grade_for(state, kind)
      { unposted: state.unposted_current_score, posted: state.current_score }[kind]
    end

    def rows_for_progress(course)
      grade_kind = @grades.call(course)
      states(course).each do |state|
        yield [course.id,
               course.name,
               state.user_id,
               state.user.name,
               state.percent_complete.to_f,
               state.requirements_completed,
               state.requirements_total,
               state.current_content_tag&.title,
               grade_for(state, grade_kind),
               state.last_active_at&.iso8601]
      end
    end

    def rows_for_pacing(course)
      states(course).each do |state|
        yield [course.id,
               course.name,
               state.user_id,
               state.user.name,
               state.percent_complete.to_f,
               state.expected_percent,
               state.days_behind,
               state.target_date&.iso8601]
      end
    end

    def rows_for_time_on_task(course)
      totals = ActivityDay.where(course:, day: @from..@to).group(:user_id)
                          .pluck(:user_id,
                                 Arel.sql("SUM(active_seconds)"),
                                 Arel.sql("COUNT(*)"),
                                 Arel.sql("SUM(submissions_count)"),
                                 Arel.sql("MAX(day)"))
                          .index_by(&:first)
      states(course).each do |state|
        _, seconds, days, submissions, last_day = totals[state.user_id]
        yield [course.id,
               course.name,
               state.user_id,
               state.user.name,
               seconds.to_i / 60,
               days.to_i,
               submissions.to_i,
               last_day&.iso8601]
      end
    end

    def rows_for_interventions(course)
      Intervention.where(course:, created_at: @from.beginning_of_day..@to.end_of_day)
                  .order(:created_at, :id).preload(:student, :actor, :content_tag).each do |log|
        yield [log.created_at.to_date.iso8601,
               course.id,
               course.name,
               log.student_id,
               log.student.name,
               log.kind,
               log.content_tag&.title,
               log.actor.name,
               log.reason]
      end
    end

    def rows_for_engaged_days(course)
      days = Attendance.days(course, from: @from, to: @to)
      states(course).each do |state|
        mine = days[state.user_id] || []
        yield [course.id,
               course.name,
               state.user_id,
               state.user.name,
               mine.count(&:present),
               mine.count { |day| day.active_minutes.positive? || day.submissions.positive? },
               mine.count(&:adjusted),
               mine.sum(&:active_minutes)]
      end
    end
  end
end
