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

# The dashboard's drill-down for one student in one course
# (docs/fork-plan.md feature C): daily activity, time and completion per
# module item, attempt history, and a timeline of recent events.
module SelfPaced
  class StudentDetail
    ACTIVITY_DAYS = 28
    TIMELINE_LENGTH = 40

    def initialize(scope, course, student, now: Time.zone.now)
      @scope = scope
      @course = course
      @student = student
      @now = now
    end

    def as_json
      state = StudentCourseState.find_by(course: @course, user: @student)
      roster = Roster.new(@scope, now: @now)
      {
        student: { id: @student.id.to_s, name: @student.name, sortable_name: @student.sortable_name },
        course: { id: @course.id.to_s, name: @course.name, course_code: @course.course_code },
        status: (state && @scope.live_visible?(@course)) ? roster.status(state) : nil,
        percent_complete: state&.percent_complete.to_f,
        requirements_completed: state&.requirements_completed.to_i,
        requirements_total: state&.requirements_total.to_i,
        current_item_id: state&.current_content_tag_id&.to_s,
        grades_visible: @scope.grades_visible?(@course),
        activity:,
        items:,
        attempts:,
        timeline:
      }
    end

    private

    def today
      @today ||= @now.in_time_zone(@course.time_zone).to_date
    end

    # One entry per day for the last ACTIVITY_DAYS days, zeros included, so the
    # chart doesn't have to guess about gaps.
    def activity
      from = today - (ACTIVITY_DAYS - 1)
      days = ActivityDay.where(course: @course, user: @student, day: from..today).index_by(&:day)
      (from..today).map do |day|
        row = days[day]
        { day: day.iso8601, active_seconds: row&.active_seconds.to_i, submissions: row&.submissions_count.to_i }
      end
    end

    def module_tags
      @module_tags ||= @course.context_module_tags.not_deleted
                              .where.not(content_type: "ContextModuleSubHeader")
                              .joins(:context_module)
                              .merge(ContextModule.not_deleted)
                              .preload(:context_module)
                              .reorder("context_modules.position, context_modules.id, content_tags.position, content_tags.id")
                              .to_a
    end

    def item_times
      @item_times ||= ItemTime.where(course: @course, user: @student).index_by(&:content_tag_id)
    end

    def completed_tag_ids
      @completed_tag_ids ||= ContextModuleProgression.where(user: @student, context_module_id: module_tags.map(&:context_module_id).uniq)
                                                     .flat_map { |progression| (progression.requirements_met || []).pluck(:id) }
                                                     .to_set
    end

    # Every module item in course order, with the time spent and whether its
    # requirement is met.
    def items
      module_tags.map do |tag|
        time = item_times[tag.id]
        {
          id: tag.id.to_s,
          title: tag.title,
          type: tag.content_type,
          module: tag.context_module.name,
          active_seconds: time&.active_seconds.to_i,
          last_viewed_at: time&.last_viewed_at&.iso8601,
          completed: completed_tag_ids.include?(tag.id)
        }
      end
    end

    def submissions
      @submissions ||= Submission.active
                                 .where(user: @student, course: @course)
                                 .where("submissions.attempt > 0")
                                 .preload(:assignment)
                                 .to_a
    end

    # Every graded attempt, newest submission first. Scores are left out when
    # the viewer can't see grades.
    def attempts
      show_scores = @scope.grades_visible?(@course)
      submissions.sort_by { |s| s.submitted_at || Time.zone.at(0) }.reverse.map do |submission|
        history = submission.submission_history.select { |version| version.attempt.to_i.positive? }.uniq(&:attempt)
        {
          assignment_id: submission.assignment_id.to_s,
          title: submission.assignment.title,
          points_possible: submission.assignment.points_possible,
          attempts: history.sort_by(&:attempt).map do |version|
            {
              attempt: version.attempt,
              submitted_at: version.submitted_at&.iso8601,
              score: show_scores ? version.score : nil,
              workflow_state: version.workflow_state
            }
          end
        }
      end
    end

    # Recent submissions and item views, newest first.
    def timeline
      titles = module_tags.index_by(&:id)
      views = item_times.values.filter_map do |time|
        tag = titles[time.content_tag_id]
        tag && { kind: "viewed", title: tag.title, at: time.last_viewed_at&.iso8601, active_seconds: time.active_seconds }
      end
      submitted = attempts.flat_map do |assignment|
        assignment[:attempts].map do |attempt|
          { kind: "submitted", title: assignment[:title], at: attempt[:submitted_at], attempt: attempt[:attempt], score: attempt[:score], points_possible: assignment[:points_possible] }
        end
      end
      (views + submitted).select { |event| event[:at] }.sort_by { |event| event[:at] }.reverse.first(TIMELINE_LENGTH)
    end
  end
end
