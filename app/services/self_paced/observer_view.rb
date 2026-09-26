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

# What a parent or other observer sees about the students they follow in
# self-paced classes (docs/fork-plan.md Phase 8): progress, pace, recent posted
# grades, time on task and any open behind-pace or inactive alerts. Read only,
# and only for a student the observer is linked to in the course (an
# observer enrollment), in a course where the observer view is on.
module SelfPaced
  class ObserverView
    GRADES_WINDOW = 30.days
    GRADES_SHOWN = 10
    ALERT_KINDS = %w[behind inactive].freeze
    DAYS_SHOWN = 7
    NOT_OBSERVER_ENROLLMENTS = %w[StudentEnrollment TeacherEnrollment TaEnrollment DesignerEnrollment].freeze

    # Observers only: people who are already students or staff somewhere keep
    # their own home pages.
    def self.show_for?(user, root_account)
      return false unless user && SelfPaced.enabled?(root_account)
      return false if user.account_membership? || user.enrollments.active.where(type: NOT_OBSERVER_ENROLLMENTS).exists?

      new(user).links.any?
    end

    def initialize(observer, now: Time.zone.now)
      @observer = observer
      @now = now
    end

    # The observer's (student, course) pairs where the view is on and the
    # student is still enrolled. A student counts once the school has linked
    # them to the observer, by an observation link or an observer enrollment.
    def links
      @links ||= begin
        student_ids = linked_student_ids
        StudentEnrollment.where(workflow_state: "active", user_id: student_ids).preload(:course).filter_map do |enrollment|
          [enrollment.user_id, enrollment.course] if viewable_course?(enrollment.course)
        end.uniq
      end
    end

    # Whether the person observes anyone at all, whatever the classes are.
    def self.observer?(user)
      user.as_observer_observation_links.active.exists? ||
        user.observer_enrollments.active.where.not(associated_user_id: nil).exists?
    end

    def linked_student_ids
      @observer.as_observer_observation_links.active.pluck(:user_id) |
        @observer.observer_enrollments.active.where.not(associated_user_id: nil).pluck(:associated_user_id)
    end

    def as_json
      by_student = links.group_by(&:first)
      students = User.where(id: by_student.keys).index_by(&:id)
      {
        observer: { id: @observer.id.to_s, name: @observer.name },
        students: by_student.filter_map do |student_id, pairs|
          student = students[student_id]
          student && student_json(student, pairs.map(&:last))
        end.sort_by { |json| json[:name] }
      }
    end

    private

    def viewable_course?(course)
      course&.available? && Gating.player_course?(course) && SelfPaced.feature_enabled?(course, :self_paced_observer_view)
    end

    def student_json(student, courses)
      ids = courses.map(&:id)
      states = StudentCourseState.where(user: student, course_id: ids).index_by(&:course_id)
      {
        id: student.id.to_s,
        name: student.name,
        short_name: student.short_name,
        courses: courses.sort_by(&:name).map { |course| course_json(course, states[course.id]) },
        time: time_json(student, ids),
        grades: grades_json(student, ids),
        alerts: alerts_json(student, ids)
      }
    end

    def course_json(course, state)
      {
        id: course.id.to_s,
        name: course.name,
        course_code: course.course_code,
        color: course.course_color.presence,
        percent_complete: state&.percent_complete.to_f.round,
        requirements_completed: state&.requirements_completed.to_i,
        requirements_total: state&.requirements_total.to_i,
        last_active_at: state&.last_active_at&.iso8601,
        pace: pace_json(state)
      }
    end

    # Days behind (negative when ahead) against the student's plan.
    def pace_json(state)
      return nil unless state&.days_behind

      { days_behind: state.days_behind, target_date: state.target_date&.iso8601, expected_percent: state.expected_percent&.to_f&.round }
    end

    # Active minutes for each of the last DAYS_SHOWN days, oldest first, and
    # this week against the one before.
    def time_json(student, course_ids)
      today = @now.to_date
      first = today - ((DAYS_SHOWN * 2) - 1)
      seconds = ActivityDay.where(user: student, course_id: course_ids, day: first..today).group(:day).sum(:active_seconds)
                           .transform_keys { |day| Date.parse(day.to_s) }
      recent = ((today - (DAYS_SHOWN - 1))..today).map { |day| { day: day.iso8601, minutes: seconds.fetch(day, 0) / 60 } }
      before = ((first)..(today - DAYS_SHOWN)).sum { |day| seconds.fetch(day, 0) / 60 }
      { daily: recent, week_minutes: recent.sum { |day| day[:minutes] }, previous_week_minutes: before }
    end

    # Posted grades only, newest first.
    def grades_json(student, course_ids)
      Submission.active
                .where(user: student, course_id: course_ids)
                .where(graded_at: (@now - GRADES_WINDOW)..@now)
                .where.not(score: nil)
                .where.not(posted_at: nil)
                .where(excused: [nil, false])
                .preload(:assignment, :course)
                .order(graded_at: :desc)
                .limit(GRADES_SHOWN)
                .map do |submission|
        {
          id: submission.id.to_s,
          title: submission.assignment.title,
          course: submission.course.name,
          score: submission.score,
          points_possible: submission.assignment.points_possible,
          graded_at: submission.graded_at.iso8601
        }
      end
    end

    def alerts_json(student, course_ids)
      Alert.currently_open.where(student:, course_id: course_ids, kind: ALERT_KINDS).preload(:course).order(opened_at: :desc).map do |alert|
        { id: alert.id.to_s, kind: alert.kind, description: alert.description, course: alert.course.name, opened_at: alert.opened_at.iso8601 }
      end
    end
  end
end
