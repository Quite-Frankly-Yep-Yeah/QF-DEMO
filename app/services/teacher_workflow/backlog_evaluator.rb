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
  # Opens a backlog alert for a course when its oldest ungraded item has waited
  # longer than the school's limit (in school days), tells the school's admins
  # once, and resolves the alert when the backlog clears.
  class BacklogEvaluator
    NOTIFICATION_NAME = "Grading Backlog"
    DEFAULT_DAYS = 5

    class << self
      # Periodic job. course_id => oldest waiting submission, for every course
      # that has any; open alerts for courses not in that list are resolved.
      def evaluate_all(now: Time.zone.now)
        oldest = Submission.needs_grading
                           .where(assignments: { context_type: "Course", workflow_state: "published" })
                           .group("assignments.context_id")
                           .minimum("submissions.submitted_at")
        Course.where(id: oldest.keys).preload(:root_account, :account).find_each do |course|
          next unless TeacherWorkflow.feature_enabled?(course, :workflow_grading_queue)

          evaluate_course(course, oldest.fetch(course.id), now:)
        end
        BacklogAlert.currently_open.where.not(course_id: oldest.keys).find_each { |alert| alert.resolve!(now) }
      end

      def evaluate_course(course, oldest_waiting_at, now: Time.zone.now)
        new(course, now:).evaluate(oldest_waiting_at)
      end
    end

    def initialize(course, now: Time.zone.now)
      @course = course
      @now = now
    end

    def evaluate(oldest_waiting_at)
      open_alert = BacklogAlert.currently_open.find_by(course_id: @course.id)
      days = school_days_waiting(oldest_waiting_at)

      if days >= limit
        open_alert ||= open_alert!(oldest_waiting_at, days)
        open_alert.update!(school_days_waiting: days, oldest_waiting_at:)
        notify(open_alert) if open_alert.notified_at.nil?
      elsif open_alert
        open_alert.resolve!(@now)
      end
    end

    private

    def limit
      value = @course.account.grading_backlog_days&.dig(:value).to_i
      value.positive? ? value : DEFAULT_DAYS
    end

    def school_days_waiting(oldest_waiting_at)
      zone = @course.time_zone
      SchoolCalendar.new(@course).count_between(oldest_waiting_at.in_time_zone(zone).to_date, @now.in_time_zone(zone).to_date)
    end

    def open_alert!(oldest_waiting_at, days)
      BacklogAlert.create!(course: @course, oldest_waiting_at:, school_days_waiting: days, opened_at: @now)
    end

    def notify(alert)
      notification = BroadcastPolicy.notification_finder.by_name(NOTIFICATION_NAME)
      return unless notification

      recipients = admins
      notification.create_message(alert, recipients) if recipients.any?
      alert.update_columns(notified_at: @now)
    end

    # School admins who can manage alert rules for the course's account.
    def admins
      account = @course.account
      AccountUser.active.where(account_id: account.account_chain_ids).preload(:user).filter_map(&:user).uniq
                 .select { |user| account.grants_right?(user, :self_paced_manage_alert_rules) }
    end
  end
end
