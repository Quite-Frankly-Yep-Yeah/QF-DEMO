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

# Opens and resolves alerts from the read model (docs/fork-plan.md Phase 6).
#
# For each course with alerts on, every student's SelfPaced::StudentCourseState
# is checked against the course's rules (AlertRule.effective_for). A condition
# that is newly true opens an alert and, if the rule says so, tells the
# student's assigned mentors (or the course's teachers when nobody has pinned
# them). An open alert whose condition is no longer true is resolved.
module SelfPaced
  class AlertEvaluator
    NOTIFICATION_NAME = "Self Paced Alert"
    OBSERVER_NOTIFICATION_NAME = "Self Paced Observer Alert"
    OBSERVER_KINDS = ObserverView::ALERT_KINDS

    class << self
      # Periodic job: queue an evaluation of every course that has tracked students.
      def evaluate_all
        course_ids = StudentCourseState.distinct.pluck(:course_id)
        Course.where(id: course_ids).find_each do |course|
          delay(n_strand: ["self_paced_alerts", course.global_root_account_id]).evaluate_course(course)
        end
      end

      def evaluate_course(course, now: Time.zone.now)
        return unless SelfPaced.feature_enabled?(course, :self_paced_alerts)
        return unless SelfPaced.feature_enabled?(course, :self_paced_activity_tracking)

        new(course, now:).evaluate
      end
    end

    def initialize(course, now: Time.zone.now)
      @course = course
      @now = now
      @rules = AlertRule.effective_for(course)
    end

    def evaluate
      states = StudentCourseState.where(course: @course).preload(:current_content_tag).to_a
      open_alerts = alerts_by_student_and_kind(Alert.currently_open)
      # Staff dismissed these; they stay quiet until the trouble has cleared once.
      dismissed = alerts_by_student_and_kind(Alert.where(workflow_state: "dismissed").where("detail->>'cleared' IS NULL"))
      opened = []

      states.each do |state|
        AlertRule::KINDS.each do |kind|
          rule = @rules.fetch(kind)
          key = [state.user_id, kind]
          existing = open_alerts.delete(key)&.first
          waiting = dismissed.delete(key)
          detail = rule.enabled? ? condition(kind, rule, state) : nil

          if detail && existing.nil? && waiting.nil?
            opened << open_alert(state, rule, detail)
          elsif detail.nil?
            existing&.resolve!(@now)
            waiting&.each { |alert| alert.update!(detail: alert.detail.merge("cleared" => true)) }
          end
        end
      end

      # what's left belongs to students who left the course
      open_alerts.each_value { |alerts| alerts.each { |alert| alert.resolve!(@now) } }
      opened.compact.each { |alert, rule| notify(alert) if rule.notify? }
    end

    private

    def alerts_by_student_and_kind(scope)
      scope.where(course: @course).group_by { |a| [a.student_id, a.kind] }
    end

    # A hash describing the trouble, or nil when the student is fine.
    def condition(kind, rule, state)
      case kind
      when "behind"
        { days_behind: state.days_behind, threshold: rule.threshold } if state.days_behind && state.days_behind >= rule.threshold
      when "stuck"
        { attempts: state.attempts_on_current_item, threshold: rule.threshold } if stuck?(state, rule)
      when "max_attempts"
        { attempts: state.attempts_on_current_item } if out_of_attempts?(state)
      when "inactive"
        idle = inactive_days(state)
        { days_inactive: idle, threshold: rule.threshold } if idle >= rule.threshold
      when "low_grade"
        score = state.current_score
        { score: score.to_f, threshold: rule.threshold } if score && score < rule.threshold
      end
    end

    def stuck?(state, rule)
      state.current_content_tag && state.attempts_on_current_item >= rule.threshold
    end

    def out_of_attempts?(state)
      content = state.current_content_tag&.content
      ItemFacts.attempts_limited?(content) && state.attempts_on_current_item >= content.allowed_attempts.to_i
    end

    # Whole days since the student was last active. A student who has never
    # been active counts from when they were first tracked, so a new
    # enrollment doesn't alert on day one.
    def inactive_days(state)
      since = state.last_active_at || state.created_at
      ((@now - since) / 1.day).floor
    end

    def open_alert(state, rule, detail)
      alert = Alert.create!(
        course: @course,
        student_id: state.user_id,
        kind: rule.kind,
        content_tag: %w[stuck max_attempts].include?(rule.kind) ? state.current_content_tag : nil,
        detail:,
        opened_at: @now
      )
      [alert, rule]
    rescue ActiveRecord::RecordNotUnique
      nil
    end

    def notify(alert)
      notification = BroadcastPolicy.notification_finder.by_name(NOTIFICATION_NAME)
      return unless notification

      recipients = RelockNotifier.recipients(alert.student, @course)
      notification.create_message(alert, recipients)
      alert.update_columns(notified_at: @now)
      notify_observers(alert)
    end

    # Parents hear about a student who is behind or has gone quiet (Phase 8),
    # when the observer view is on; the rest is for staff.
    def notify_observers(alert)
      return unless OBSERVER_KINDS.include?(alert.kind) && SelfPaced.feature_enabled?(@course, :self_paced_observer_view)

      notification = BroadcastPolicy.notification_finder.by_name(OBSERVER_NOTIFICATION_NAME)
      return unless notification

      observers = @course.observer_enrollments.active.where(associated_user_id: alert.student_id).preload(:user).filter_map(&:user).uniq
      notification.create_message(alert, observers) if observers.any?
    end
  end
end
