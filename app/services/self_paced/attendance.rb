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

# Reads the activity facts through the school's attendance policy
# (docs/fork-plan.md §2.10). Each day is judged by the policy in force on that
# day, so changing the policy never rewrites the past, and a staff
# correction for a day beats the policy.
module SelfPaced
  class Attendance
    Day = Struct.new(:day, :active_minutes, :submissions, :present, :adjusted, keyword_init: true)

    # {student_id => [Day]} for the students in +course+ (all of them when
    # +student_ids+ is nil) between +from+ and +to+ (dates, inclusive), oldest
    # first. Only days with activity or a correction appear.
    def self.days(course, from:, to:, student_ids: nil)
      new(course).days(from:, to:, student_ids:)
    end

    def initialize(course)
      @course = course
      @policies = AttendancePolicy.where(root_account_id: course.root_account_id).order(:effective_on).to_a
    end

    def days(from:, to:, student_ids: nil)
      facts = ActivityDay.where(course: @course, day: from..to)
      facts = facts.where(user_id: student_ids) if student_ids
      adjustments = latest_adjustments(from, to, student_ids)

      by_key = {}
      facts.find_each { |fact| by_key[[fact.user_id, fact.day]] = fact }
      keys = (by_key.keys | adjustments.keys).sort
      keys.group_by(&:first).transform_values do |student_keys|
        student_keys.map { |key| judge(key.last, by_key[key], adjustments[key]) }
      end
    end

    private

    # The policy for a day, or the built-in default when the school has none
    # that early.
    def policy_for(day)
      @policies.reverse.find { |policy| policy.effective_on <= day } || AttendancePolicy.new(AttendancePolicy::DEFAULT)
    end

    def judge(day, fact, adjustment)
      policy = policy_for(day)
      minutes = (fact&.active_seconds.to_i / 60) + adjustment&.minutes.to_i
      submissions = fact&.submissions_count.to_i
      present = if adjustment
                  adjustment.present
                else
                  minutes >= policy.min_active_minutes || (policy.submission_counts && submissions.positive?)
                end
      Day.new(day:, active_minutes: minutes, submissions:, present:, adjusted: !adjustment.nil?)
    end

    def latest_adjustments(from, to, student_ids)
      scope = AttendanceAdjustment.where(course: @course, day: from..to).order(:created_at, :id)
      scope = scope.where(student_id: student_ids) if student_ids
      scope.index_by { |adjustment| [adjustment.student_id, adjustment.day] }
    end
  end
end
