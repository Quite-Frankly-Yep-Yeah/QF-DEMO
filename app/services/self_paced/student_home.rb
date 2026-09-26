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

# The student's home page in self-paced courses (flag
# self_paced_student_home): where to pick up, each class's progress, pace and
# today's goal, what's due this week and recent feedback.
#
# Reads the dashboard read model (student_course_states) and pacing plans,
# not CourseProgress, so it stays cheap for a student in many classes.
module SelfPaced
  class StudentHome
    DUE_WINDOW = 7.days
    FEEDBACK_WINDOW = 14.days
    LIST_LENGTH = 8

    # Every student (not staff or admins) once the home page is on for the
    # school, including one with no classes yet, such as a just-provisioned
    # account: the page says so, and fills in as they are enrolled.
    def self.show_for?(user, root_account)
      return false unless user && SelfPaced.feature_enabled?(root_account, :self_paced_student_home)

      return false if user.active_non_student_enrollment? || user.account_membership?

      # someone who observes students (a parent) gets the observer view, unless they are a student too
      !ObserverView.observer?(user) || user.student_enrollments.active.exists?
    end

    def initialize(user, now: Time.zone.now)
      @user = user
      @now = now
    end

    # The student's active classes.
    def courses
      @courses ||= Course.where(id: @user.student_enrollments.active_by_date.select(:course_id))
                         .where(workflow_state: "available")
                         .order(:name, :id)
                         .to_a
    end

    def player_courses
      @player_courses ||= courses.select do |course|
        Gating.player_course?(course) && SelfPaced.feature_enabled?(course, :self_paced_student_home)
      end
    end

    def as_json
      cards = player_courses.map { |course| course_json(course) }
      {
        student: { id: @user.id.to_s, name: @user.name, short_name: @user.short_name },
        courses: cards,
        # the class to pick up in: the one worked on most recently
        resume_course_id: cards.select { |c| c[:continue] }.max_by { |c| c[:last_active_at].to_s }&.dig(:id),
        due_soon:,
        feedback:,
        other_courses: (courses - player_courses).map do |course|
          { id: course.id.to_s, name: course.name, course_code: course.course_code, url: "/courses/#{course.id}", color: course.course_color.presence }
        end
      }
    end

    private

    def states
      @states ||= StudentCourseState.where(user: @user, course_id: player_courses.map(&:id))
                                    .preload(:current_content_tag)
                                    .index_by(&:course_id)
    end

    def course_json(course)
      state = states[course.id]
      tag = state&.current_content_tag
      pace = pace_json(course)
      {
        id: course.id.to_s,
        name: course.name,
        course_code: course.course_code,
        color: course.course_color.presence,
        image_url: course.image,
        url: "/courses/#{course.id}/player",
        percent_complete: state&.percent_complete.to_f.round,
        requirements_completed: state&.requirements_completed.to_i,
        requirements_total: state&.requirements_total.to_i,
        # a posted grade only; nil until one is posted
        score: state&.current_score,
        last_active_at: state&.last_active_at&.iso8601,
        continue: tag && {
          title: tag.title,
          module: tag.context_module&.name,
          url: "/courses/#{course.id}/modules/items/#{tag.id}"
        },
        pace:
      }
    end

    def pace_json(course)
      return nil unless Pacer.course?(course)

      status = Pacer.new(course, @user).status
      return nil unless status

      {
        days_ahead: status[:days_ahead],
        finished: status[:finished],
        target_date: status[:target_date].iso8601,
        today: status[:today].slice(:done, :total, :minutes),
        week: status[:week].slice(:done, :total)
      }
    end

    # Work due in the next week that isn't handed in, earliest first. Uses
    # each student's own due date (overrides and pacing dates included).
    def due_soon
      Submission.active
                .where(user: @user, course_id: player_courses.map(&:id))
                .where(cached_due_date: @now..(@now + DUE_WINDOW))
                .where(submitted_at: nil)
                .where(excused: [nil, false])
                .joins(:assignment).merge(Assignment.published)
                .preload(:assignment)
                .order(:cached_due_date)
                .limit(LIST_LENGTH)
                .map do |submission|
        {
          id: submission.assignment_id.to_s,
          title: submission.assignment.title,
          course_id: submission.course_id.to_s,
          due_at: submission.cached_due_date.iso8601,
          url: "/courses/#{submission.course_id}/assignments/#{submission.assignment_id}"
        }
      end
    end

    # Grades posted in the last two weeks, newest first. Unposted grades never
    # show here.
    def feedback
      Submission.active
                .where(user: @user, course_id: player_courses.map(&:id))
                .where(graded_at: (@now - FEEDBACK_WINDOW)..@now)
                .where.not(score: nil)
                .where.not(posted_at: nil)
                .preload(:assignment)
                .order(graded_at: :desc)
                .limit(LIST_LENGTH)
                .map do |submission|
        {
          id: submission.id.to_s,
          title: submission.assignment.title,
          course_id: submission.course_id.to_s,
          score: submission.score,
          points_possible: submission.assignment.points_possible,
          graded_at: submission.graded_at.iso8601,
          url: "/courses/#{submission.course_id}/assignments/#{submission.assignment_id}/submissions/#{@user.id}"
        }
      end
    end
  end
end
