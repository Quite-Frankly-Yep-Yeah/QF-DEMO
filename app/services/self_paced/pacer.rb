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

# The pacing engine for one student in one course (docs/fork-plan.md §2.3).
#
# The student's required module items (in module order, minus exempt ones,
# each with an estimate in minutes) are spread over the school days between
# their start date and target date:
#
# - the baseline is spread once, when the plan is made or its dates change,
#   and is what "days ahead or behind" is measured against;
# - the current plan re-spreads the unfinished work from today, at most once a
#   day unless something explicit changes (a new target date, the calendar,
#   the course setup). Its dates become the student's due dates
#   (SelfPaced::DueDateWriter).
module SelfPaced
  class Pacer
    # Used when the course, section, term and enrollment have no end date.
    DEFAULT_LENGTH = 36.weeks
    # Only these contents are read to estimate minutes.
    ESTIMATED_CONTENT = %w[WikiPage Quizzes::Quiz].freeze

    Item = Struct.new(:id, :minutes, :assignment_id)

    class << self
      def course?(course)
        course.is_a?(Course) && SelfPaced.feature_enabled?(course, :self_paced_pacing)
      end

      # A structural change (course setup, calendar, blackout dates) re-spreads
      # every student's current plan now instead of tomorrow.
      def replan_course_later(course)
        return unless course?(course)

        delay(singleton: "self_paced_replan:#{course.global_id}", run_at: 1.minute.from_now).replan_course(course.id)
      end

      def replan_course(course_id)
        course = Course.find_by(id: course_id)
        return unless course && course?(course)

        user_ids = course.student_enrollments.active.distinct.pluck(:user_id)
        User.where(id: user_ids).find_each do |user|
          new(course, user).refresh!(force: true)
          StateRefresher.refresh(course, user) if SelfPaced.feature_enabled?(course, :self_paced_activity_tracking)
        end
      end

      # Replans every paced course under these accounts (a calendar or an
      # account blackout date changed).
      def replan_accounts_later(account_ids)
        ids = account_ids.flat_map { |id| [id, *Account.sub_account_ids_recursive(id)] }.uniq
        course_ids = PacingPlan.joins(:course).where(courses: { account_id: ids }).distinct.pluck(:course_id)
        Course.where(id: course_ids).find_each { |course| replan_course_later(course) }
      end

      # BlackoutDate after_commit. Cheap when self-paced is off.
      def blackout_changed(blackout_date)
        context = blackout_date.context
        return unless context && SelfPaced.enabled?(context)

        case context
        when Course then replan_course_later(context)
        when Account then replan_accounts_later([context.id])
        end
      end
    end

    attr_reader :course, :user, :calendar, :today

    def initialize(course, user, today: nil, calendar: nil)
      @course = course
      @user = user
      @calendar = calendar || SchoolCalendar.new(course)
      @today = today || @calendar.today
    end

    def plan
      return @plan if defined?(@plan)

      @plan = PacingPlan.find_by(course:, user:)
    end

    def enrollment
      @enrollment ||= course.student_enrollments.active.where(user_id: user).order(:id).first
    end

    # Makes the plan if the student has none, and re-spreads the current plan
    # once a day, or now when +force+. Returns the plan, or nil if the student
    # isn't actively enrolled.
    def refresh!(force: false)
      return nil unless enrollment

      if plan.nil?
        create_plan!
      elsif force || plan.planned_on.nil? || plan.planned_on < today
        replan!
      end
      plan
    end

    # A teacher's target date for this student. It wins over the course's end
    # date until it's reset.
    def set_target!(date, actor:)
      return nil unless refresh!

      plan.assign_attributes(target_date: [date, plan.start_date].max, target_source: "teacher", target_set_by: actor)
      rebuild!
    end

    def reset_target!(actor:)
      return nil unless refresh!

      plan.assign_attributes(target_date: default_target_date, target_source: "default", target_set_by: actor)
      rebuild!
    end

    # Where the student stands against their plan, or nil without one.
    def status
      return nil unless plan

      @status ||= begin
        fraction = complete_fraction
        baseline_days = Array(plan.baseline["days"]).map { |date, share| [Date.iso8601(date), share.to_f] }
        reached = baseline_days.count { |_, share| share <= fraction + 1e-6 }
        elapsed = baseline_days.count { |date, _| date < today }
        last_day = baseline_days.last&.first
        elapsed += calendar.count_between(last_day + 1, today) if last_day && today > last_day + 1
        days_ahead = reached - elapsed
        days_ahead = [days_ahead, 0].max if fraction >= 1
        expected = elapsed.zero? ? 0.0 : baseline_days[[elapsed, baseline_days.size].min - 1][1]

        planned = Array(plan.current["items"]).map { |id, date, minutes| [id.to_i, Date.iso8601(date), minutes.to_i] }
        {
          start_date: plan.start_date,
          target_date: plan.target_date,
          target_source: plan.target_source,
          days_ahead:,
          expected_percent: (expected * 100).round(1),
          percent_complete: (fraction * 100).round(1),
          finished: fraction >= 1,
          daily_minutes: plan.current["daily_minutes"].to_i,
          today: goal(planned.select { |_, date, _| date <= today }),
          week: goal(planned.select { |_, date, _| date <= today.end_of_week })
        }
      end
    end

    # The dashboard read model's pacing columns. Also records today's progress
    # for the planned-vs-actual chart.
    def state_attributes
      unless status
        return { days_behind: nil, target_date: nil, expected_percent: nil }
      end

      record_history(status[:percent_complete])
      { days_behind: -status[:days_ahead], target_date: plan.target_date, expected_percent: status[:expected_percent] }
    end

    # The pacing API's response: the status, the items planned through this
    # week, and the chart series.
    def as_json(can_adjust: false)
      return nil unless status

      week_ids = status[:week][:item_ids]
      tags = ContentTag.where(id: week_ids).index_by(&:id)
      urls = Rails.application.routes.url_helpers
      status.except(:today, :week).merge(
        start_date: plan.start_date.iso8601,
        target_date: plan.target_date.iso8601,
        today: status[:today].except(:item_ids).merge(item_ids: status[:today][:item_ids].map(&:to_s)),
        week: status[:week].except(:item_ids),
        items: week_ids.filter_map do |id|
          tag = tags[id] or next
          {
            id: id.to_s,
            title: tag.title,
            type: tag.content_type,
            url: urls.course_context_modules_item_redirect_path(course_id: course.id, id:),
            planned_date: plan.planned_dates[id]&.iso8601,
            completed: completed_ids.include?(id)
          }
        end,
        chart:,
        can_adjust:
      )
    end

    # {tag_id => [minutes, assignment_id]} for the whole course, cached until
    # a module item or item setting changes.
    def item_estimates
      key = ["self_paced_item_estimates",
             course.global_id,
             course.context_module_tags.not_deleted.reorder(nil).maximum(:updated_at)&.to_f,
             ItemSetting.where(course:).maximum(:updated_at)&.to_f].cache_key
      Rails.cache.fetch(key, expires_in: 1.day) do
        tags = course.context_module_tags.not_deleted.reorder(nil).to_a
        ActiveRecord::Associations.preload(tags.select { |tag| ESTIMATED_CONTENT.include?(tag.content_type) }, :content)
        settings = ItemSetting.where(course:).index_by(&:content_tag_id)
        tags.to_h { |tag| [tag.id, estimate(tag, settings[tag.id])] }
      end
    end

    private

    def create_plan!
      start = default_start_date
      @plan = PacingPlan.new(course:, user:, start_date: start, target_date: default_target_date(start), target_source: "default")
      rebuild!
      record_accommodation(nil)
      @plan
    rescue ActiveRecord::RecordNotUnique
      # Another job made it first.
      @plan = PacingPlan.find_by!(course:, user:)
    end

    # Rebuilds both plans: when the plan is made or its dates change.
    def rebuild!
      build_baseline
      spread_current
      plan.version += 1 if plan.persisted?
      plan.planned_on = today
      plan.save!
      @status = nil
      write_due_dates_later
      plan
    end

    # The daily re-spread. If the target still follows the course's end date
    # and that date moved, the baseline follows too.
    def replan!
      applied = plan.baseline["accommodation"]
      target_before = plan.target_date
      if plan.target_source == "default"
        target = default_target_date(plan.start_date)
        if target != plan.target_date
          plan.target_date = target
          plan.version += 1
          build_baseline
        end
      end
      # the student's pacing accommodation changed (Supports::PacingAccommodation)
      if plan.baseline["accommodation"] != pacing_accommodation&.key
        plan.version += 1
        build_baseline
      end
      spread_current
      plan.planned_on = today
      plan.save!
      @status = nil
      write_due_dates_later
      record_accommodation(applied, target_before)
    end

    def build_baseline
      result = PlanBuilder.spread(items.map { |item| [item.id, item.minutes] }, days_between(plan.start_date, spread_end))
      total = result[:days].last[1].to_f
      plan.baseline = {
        "days" => result[:days].map { |date, minutes| [date.iso8601, total.positive? ? (minutes / total).round(4) : 1.0] },
        "total_minutes" => total.round
      }
      plan.baseline["accommodation"] = pacing_accommodation.key if pacing_accommodation
    end

    def spread_current
      from = [today, plan.start_date].max
      remaining = items.reject { |item| completed_ids.include?(item.id) }
      result = PlanBuilder.spread(remaining.map { |item| [item.id, item.minutes] }, days_between(from, [spread_end, from].max))
      plan.current = {
        "from" => from.iso8601,
        "items" => result[:items].map { |id, date, minutes| [id, date.iso8601, minutes] },
        "days" => result[:days].map { |date, minutes| [date.iso8601, minutes] },
        "daily_minutes" => result[:daily_minutes],
        "done_minutes" => done_minutes,
        "total_minutes" => total_minutes
      }
    end

    # School days in the range. A range with none (a target date that has
    # passed, or a calendar with no school days) plans everything on the next
    # school day.
    def days_between(from, to)
      calendar.instructional_days(from, to).presence || [[calendar.next_instructional_day(from), 1]]
    end

    def write_due_dates_later
      DueDateWriter.write_later(course, user)
    end

    # The student's extended-deadlines accommodation, if any
    # (Supports::PacingAccommodation).
    def pacing_accommodation
      return @pacing_accommodation if defined?(@pacing_accommodation)

      @pacing_accommodation = Supports::PacingAccommodation.for(user, course)
    end

    # The last day work is spread to: the target date, or later when the
    # accommodation lowers the daily target instead of moving the date.
    def spread_end
      return plan.target_date unless pacing_accommodation&.lower_daily?

      pacing_accommodation.extend(calendar, plan.start_date, plan.target_date)
    end

    # Records a pacing accommodation newly applied to the plan.
    def record_accommodation(applied_key, target_before = nil)
      return unless pacing_accommodation && applied_key != pacing_accommodation.key

      Supports::Application.record!(pacing_accommodation.accommodation,
                                    kind: "pacing",
                                    context: plan,
                                    course:,
                                    details: { mode: pacing_accommodation.mode,
                                               percent: pacing_accommodation.percent,
                                               target_before: target_before&.iso8601,
                                               target_date: plan.target_date.iso8601,
                                               spread_end: spread_end.iso8601 })
    end

    def goal(entries)
      {
        total: entries.size,
        done: entries.count { |id, _, _| completed_ids.include?(id) },
        minutes: entries.sum { |_, _, minutes| minutes },
        item_ids: entries.map(&:first)
      }
    end

    def chart
      total = total_minutes.to_f
      current = plan.current
      current_total = current["total_minutes"].to_f
      projected = Array(current["days"]).map do |date, minutes|
        share = current_total.positive? ? (current["done_minutes"].to_f + minutes.to_f) / current_total : 1.0
        [date, (share * 100).round(1)]
      end
      {
        baseline: Array(plan.baseline["days"]).map { |date, share| [date, (share.to_f * 100).round(1)] },
        actual: plan.history.sort.map { |date, percent| [date, percent] },
        projected:,
        today: today.iso8601,
        total_minutes: total.round
      }
    end

    def record_history(percent)
      key = today.iso8601
      return if plan.history[key] == percent

      plan.update_column(:history, plan.history.merge(key => percent))
    end

    def complete_fraction
      if total_minutes.positive?
        (done_minutes.to_f / total_minutes).clamp(0.0, 1.0)
      elsif items.any?
        items.count { |item| completed_ids.include?(item.id) }.to_f / items.size
      else
        0.0
      end
    end

    def total_minutes
      @total_minutes ||= items.sum(&:minutes)
    end

    def done_minutes
      @done_minutes ||= items.select { |item| completed_ids.include?(item.id) }.sum(&:minutes)
    end

    # The items the student has to complete, in order.
    def items
      @items ||= begin
        exempt = ItemOverride.for(user.id, course).select { |_, kinds| kinds.include?("exempt") }.keys.to_set
        estimates = item_estimates
        modules = course.modules_visible_to(user).active.order(:position, :id).to_a
        modules.flat_map do |mod|
          required = mod.completion_requirements.to_a.to_set { |req| req[:id] }
          mod.content_tags_visible_to(user).filter_map do |tag|
            next unless required.include?(tag.id) && !exempt.include?(tag.id)

            minutes, assignment_id = estimates[tag.id] || estimate(tag, ItemSetting.find_by(content_tag: tag))
            Item.new(tag.id, minutes, assignment_id)
          end
        end
      end
    end

    def estimate(tag, setting)
      assignment_id = case tag.content_type
                      when "Assignment" then tag.content_id
                      when "Quizzes::Quiz", "DiscussionTopic" then tag.content&.assignment_id
                      end
      [Estimator.minutes(tag, setting), assignment_id]
    end

    def completed_ids
      @completed_ids ||= begin
        module_ids = course.context_modules.not_deleted.pluck(:id)
        met = ContextModuleProgression.where(user_id: user.id, context_module_id: module_ids)
                                      .select(:id, :requirements_met)
                                      .flat_map { |progression| Array(progression.requirements_met).pluck(:id) }
        overrides = ItemOverride.for(user.id, course).select { |_, kinds| kinds.include?("complete") }.keys
        (met + overrides).to_set
      end
    end

    def default_start_date
      time = enrollment.start_at || [enrollment.effective_start_at, enrollment.created_at].compact.max
      (time || Time.zone.now).in_time_zone(calendar.time_zone).to_date
    end

    # The course's own target date, then the enrollment's, section's, course's
    # or term's end, then a school year from the start.
    def default_target_date(start = plan&.start_date || default_start_date)
      section = enrollment.course_section
      date = course_target_date ||
             end_date_of(enrollment.end_at) ||
             (end_date_of(section.end_at) if section&.restrict_enrollments_to_section_dates) ||
             end_date_of(course.conclude_at) ||
             end_date_of(course.enrollment_term&.end_at) ||
             (start + DEFAULT_LENGTH)
      date = [date, start].max
      pacing_accommodation&.extend_finish? ? pacing_accommodation.extend(calendar, start, date) : date
    end

    def course_target_date
      value = course.self_paced_target_date
      value.present? ? Date.iso8601(value.to_s) : nil
    rescue Date::Error
      nil
    end

    # An end time at midnight means the day before (the UI's "ends on" date).
    def end_date_of(time)
      return nil unless time

      local = time.in_time_zone(calendar.time_zone)
      (local.hour.zero? && local.min.zero?) ? local.to_date - 1 : local.to_date
    end
  end
end
