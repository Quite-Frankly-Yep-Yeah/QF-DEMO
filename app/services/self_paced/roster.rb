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

# The roster the teacher dashboard shows: one row per student and course the
# viewer can see (docs/fork-plan.md §2.6, §2.8). Reads only the read model
# tables, so it stays cheap however many students there are.
module SelfPaced
  class Roster
    # A student is online if their browser pinged this recently.
    ONLINE_WINDOW = 2.minutes
    DEFAULT_IDLE_MINUTES = 5

    STATUSES = %w[working idle away].freeze

    def initialize(scope, idle_minutes: DEFAULT_IDLE_MINUTES, now: Time.zone.now, course_id: nil)
      @scope = scope
      @course_id = course_id.presence&.to_i
      @idle_minutes = idle_minutes.to_i.clamp(1, 120)
      @now = now
    end

    def rows
      courses = @scope.courses
      courses = courses.select { |course| course.id == @course_id } if @course_id
      return [] if courses.empty?

      courses_by_id = courses.index_by(&:id)
      states = StudentCourseState.where(course_id: courses_by_id.keys)
                                 .preload(:user, :current_content_tag, :viewing_content_tag)
                                 .to_a
      pinned = pinned_student_ids(courses)
      time = active_time(courses)

      states.map do |state|
        row(state, courses_by_id[state.course_id], pinned.include?(state.user_id), time[[state.course_id, state.user_id]])
      end
    end

    def status(state)
      return "away" unless state.last_seen_at && state.last_seen_at >= @now - ONLINE_WINDOW
      return "idle" if state.last_active_at.nil? || state.last_active_at < @now - @idle_minutes.minutes

      "working"
    end

    private

    def row(state, course, pinned, time)
      live = @scope.live_visible?(course)
      {
        student: { id: state.user_id.to_s, name: state.user.name, sortable_name: state.user.sortable_name },
        course: { id: course.id.to_s, name: course.name, course_code: course.course_code },
        pinned:,
        status: live ? status(state) : nil,
        viewing: live ? item_json(state.viewing_content_tag) : nil,
        viewing_since: live ? state.viewing_since&.iso8601 : nil,
        current_item: item_json(state.current_content_tag),
        attempts_on_current_item: state.attempts_on_current_item,
        percent_complete: state.percent_complete,
        requirements_completed: state.requirements_completed,
        requirements_total: state.requirements_total,
        score: score(state, course),
        days_behind: state.days_behind,
        target_date: state.target_date&.iso8601,
        expected_percent: state.expected_percent,
        last_active_at: state.last_active_at&.iso8601,
        seconds_today: time&.first.to_i,
        seconds_this_week: time&.last.to_i
      }
    end

    def item_json(tag)
      tag && { id: tag.id.to_s, title: tag.title, type: tag.content_type }
    end

    def score(state, course)
      return nil unless @scope.grades_visible?(course)

      @scope.unposted_grades_visible?(course) ? state.unposted_current_score : state.current_score
    end

    def pinned_student_ids(courses)
      MentorCaseload.where(mentor: @scope.user, root_account_id: courses.map(&:root_account_id).uniq)
                    .pluck(:student_id).to_set
    end

    # [seconds today, seconds this week] per [course_id, user_id]. "Today" is
    # the school day in each course's time zone; weeks start on Monday.
    def active_time(courses)
      courses.each_with_object({}) do |course, result|
        today = @now.in_time_zone(course.time_zone).to_date
        today_sum = ActiveRecord::Base.sanitize_sql_array(["SUM(CASE WHEN day = ? THEN active_seconds ELSE 0 END)", today])
        ActivityDay.where(course:, day: today.beginning_of_week..today)
                   .group(:user_id)
                   .pluck(:user_id, Arel.sql(today_sum), Arel.sql("SUM(active_seconds)"))
                   .each { |user_id, seconds_today, seconds_week| result[[course.id, user_id]] = [seconds_today, seconds_week] }
      end
    end
  end
end
