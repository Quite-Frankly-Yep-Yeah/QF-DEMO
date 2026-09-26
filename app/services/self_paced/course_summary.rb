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

# The class as a whole, for the course page (docs/fork-plan.md Phase 5b):
# where students are in the course, which items take many tries, and the
# class's pace against the plan. The students themselves come from the roster.
module SelfPaced
  class CourseSummary
    # Tries on one item that count as "stuck", as on the dashboard.
    STUCK_ATTEMPTS = 3
    HARD_ITEMS = 8

    def initialize(scope, course)
      @scope = scope
      @course = course
    end

    def as_json
      {
        course: { id: @course.id.to_s, name: @course.name, course_code: @course.course_code },
        units:,
        hard_items:,
        items:,
        chart: class_chart
      }
    end

    private

    def states
      @states ||= StudentCourseState.where(course: @course).to_a
    end

    def student_ids
      @student_ids ||= states.map(&:user_id)
    end

    def module_tags
      @module_tags ||= @course.context_module_tags.not_deleted
                              .where.not(content_type: "ContextModuleSubHeader")
                              .joins(:context_module)
                              .merge(ContextModule.not_deleted)
                              .preload(:context_module, :content)
                              .reorder("context_modules.position, context_modules.id, content_tags.position, content_tags.id")
                              .to_a
    end

    # One entry per unit (module) in course order: how many students are on
    # it now, how many of those are stuck, and how many have finished it.
    def units
      by_module = module_tags.group_by(&:context_module)
      tag_module = module_tags.to_h { |tag| [tag.id, tag.context_module_id] }
      here = Hash.new(0)
      stuck = Hash.new(0)
      states.each do |state|
        module_id = tag_module[state.current_content_tag_id] or next
        here[module_id] += 1
        stuck[module_id] += 1 if state.attempts_on_current_item >= STUCK_ATTEMPTS
      end
      completed = ContextModuleProgression.where(context_module_id: by_module.keys.map(&:id), user_id: student_ids, workflow_state: "completed")
                                          .group(:context_module_id).count

      by_module.map do |context_module, tags|
        {
          id: context_module.id.to_s,
          name: context_module.name,
          item_ids: tags.map { |tag| tag.id.to_s },
          students_here: here[context_module.id],
          stuck_here: stuck[context_module.id],
          completed: completed[context_module.id].to_i
        }
      end
    end

    # Graded items where students needed the most tries, hardest first.
    def hard_items
      assignment_tags = module_tags.filter_map do |tag|
        assignment_id = ItemFacts.assignment_id(tag.content)
        [assignment_id, tag] if assignment_id
      end.uniq(&:first).to_h
      return [] if assignment_tags.empty? || student_ids.empty?

      stuck_sql = ActiveRecord::Base.sanitize_sql_array(["COUNT(*) FILTER (WHERE attempt >= ?)", STUCK_ATTEMPTS])
      stats = Submission.active
                        .where(assignment_id: assignment_tags.keys, user_id: student_ids)
                        .where("attempt > 0")
                        .group(:assignment_id)
                        .pluck(:assignment_id, Arel.sql("COUNT(*)"), Arel.sql("AVG(attempt)"), Arel.sql(stuck_sql))
      here = states.group_by(&:current_content_tag_id).transform_values(&:size)

      stats.filter_map do |assignment_id, tried, average, needed_many|
        next unless average.to_f > 1

        tag = assignment_tags[assignment_id]
        {
          id: tag.id.to_s,
          title: tag.title,
          module: tag.context_module.name,
          students_tried: tried,
          average_tries: average.to_f.round(1),
          needed_many_tries: needed_many,
          students_on_it: here[tag.id].to_i
        }
      end.sort_by { |item| [-item[:needed_many_tries], -item[:average_tries]] }.first(HARD_ITEMS)
    end

    # Every item, for choosing one in a bulk action.
    def items
      module_tags.map do |tag|
        {
          id: tag.id.to_s,
          title: tag.title,
          module: tag.context_module.name,
          graded: ItemFacts.graded_assignment(tag.content).present?,
          attempts_limited: ItemFacts.attempts_limited?(tag.content)
        }
      end
    end

    # The class's average plan and progress, in the same shape as one
    # student's chart (Pacer#chart). Nil when the course isn't paced.
    def class_chart
      return nil unless Pacer.course?(@course)

      plans = PacingPlan.where(course: @course, user_id: student_ids).to_a
      return nil if plans.empty?

      today = SchoolCalendar.new(@course).today
      baselines = plans.map { |plan| Array(plan.baseline["days"]).map { |date, share| [date, share.to_f * 100] } }
      actuals = plans.map { |plan| plan.history.sort.map { |date, percent| [date, percent.to_f] } }
      {
        # before a student's plan starts they're planned at 0%
        baseline: average(baselines, before_start: 0.0),
        # a student without progress data yet on a day is left out of that day
        actual: average(actuals, before_start: nil).select { |date, _| date <= today.iso8601 },
        projected: [],
        today: today.iso8601,
        total_minutes: plans.sum { |plan| plan.baseline["total_minutes"].to_i } / plans.size
      }
    end

    # Averages several [[date, value], ...] series on every date any of them
    # has, carrying each series' last value forward between its dates.
    def average(series, before_start:)
      series = series.reject(&:empty?)
      dates = series.flat_map { |points| points.map(&:first) }.uniq.sort
      cursors = Array.new(series.size, -1)
      dates.filter_map do |date|
        values = series.each_with_index.filter_map do |points, index|
          cursors[index] += 1 while cursors[index] + 1 < points.size && points[cursors[index] + 1][0] <= date
          cursors[index].negative? ? before_start : points[cursors[index]][1]
        end
        [date, (values.sum / values.size).round(1)] unless values.empty?
      end
    end
  end
end
