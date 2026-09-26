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

# Test-out by skill (docs/fork-plan.md Phase 9). A teacher says which skill each
# lesson teaches. When a student masters a skill, for example on a pretest whose
# parts are aligned to skills, the lessons that teach it are exempted for that
# student: they count as done and drop out of pacing.
#
# It is one-way. A student who has mastered a skill at any time stays out of its
# lessons, so a worse retake never gives them back. Staff can still undo one
# with the usual "undo" on the student's panel. Graded items are never
# exempted this way, because that would excuse a grade.
module SelfPaced
  module TestOut
    ROLES = %w[instruction practice].freeze

    class << self
      def enabled?(course)
        Gating.player_course?(course) && SelfPaced.feature_enabled?(course, :self_paced_test_out)
      end

      # Called from LearningOutcomeResult after it is saved (ModelHooks). Cheap
      # unless the result is a mastery in a course with test-out on.
      def result_committed(result)
        return unless result.mastery && result.context.is_a?(Course) && enabled?(result.context)
        return unless lessons_for(result.context, result.learning_outcome_id).exists?

        delay(singleton: "self_paced_test_out:#{result.context.global_id}:#{result.user_id}:#{result.learning_outcome_id}")
          .apply(result.context_id, result.user_id, result.learning_outcome_id)
      end

      # Exempts one student from the lessons that teach +outcome_id+, if they
      # have mastered it. Returns the items exempted this time.
      def apply(course_id, user_id, outcome_id)
        course = Course.find_by(id: course_id)
        return [] unless course && enabled?(course) && mastered?(course, user_id, outcome_id)

        skip = ItemOverride.active.where(course:, user_id:, kind: "exempt").pluck(:content_tag_id).to_set
        exempted = lessons_for(course, outcome_id).preload(:content_tag).filter_map do |setting|
          tag = setting.content_tag
          next unless testable?(tag) && !skip.include?(tag.id)

          ItemOverride.create!(content_tag: tag,
                               user_id:,
                               kind: "exempt",
                               learning_outcome_id: outcome_id,
                               reason: I18n.t("Tested out: mastered %{skill}", skill: outcome_title(outcome_id)))
          tag
        end
        Pacer.replan_course_later(course) if exempted.any?
        exempted
      end

      # A teacher just changed which lessons teach a skill, or turned test-out
      # on: catch up every student who has already mastered it.
      def sweep_later(course)
        return unless enabled?(course)

        delay(singleton: "self_paced_test_out_sweep:#{course.global_id}").sweep(course.id)
      end

      def sweep(course_id)
        course = Course.find_by(id: course_id)
        return unless course && enabled?(course)

        ItemSetting.where(course:).where.not(learning_outcome_id: nil).distinct.pluck(:learning_outcome_id).each do |outcome_id|
          mastered_user_ids(course, outcome_id).each { |user_id| apply(course.id, user_id, outcome_id) }
        end
      end

      def mastered?(course, user_id, outcome_id)
        LearningOutcomeResult.where(context: course, user_id:, learning_outcome_id: outcome_id, workflow_state: "active", mastery: true).exists?
      end

      # The students who have tested out of anything, per skill.
      def tested_out_counts(course)
        ItemOverride.active.where(course:, kind: "exempt").where.not(learning_outcome_id: nil)
                    .group(:learning_outcome_id).distinct.count(:user_id)
      end

      private

      def lessons_for(course, outcome_id)
        ItemSetting.where(course:, learning_outcome_id: outcome_id, role: ROLES)
      end

      def mastered_user_ids(course, outcome_id)
        active = course.student_enrollments.active.select(:user_id)
        LearningOutcomeResult.where(context: course, learning_outcome_id: outcome_id, workflow_state: "active", mastery: true, user_id: active)
                             .distinct.pluck(:user_id)
      end

      # Only what a student can simply skip: published, not deleted, ungraded.
      def testable?(tag)
        tag.workflow_state == "active" && ItemFacts.graded_assignment(tag.content).nil?
      end

      def outcome_title(outcome_id)
        LearningOutcome.find_by(id: outcome_id)&.title.to_s
      end
    end
  end
end
