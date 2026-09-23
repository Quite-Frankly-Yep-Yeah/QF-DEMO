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

# Review before retake (docs/fork-plan.md §2.2). When a check's item setting
# asks for it, a student whose last attempt fell short of mastery must go back
# to the lesson before trying again: they need to have reopened one of the
# instruction items before the check, in the same module, since that attempt
# finished.
#
# "Reopened" comes from data the platform already keeps: the activity ledger
# (SelfPaced::ItemTime) and Canvas's own asset access records.
module SelfPaced
  module RetakeRules
    class << self
      def review_pending?(quiz, user)
        !review_items_to_revisit(quiz, user).empty?
      end

      # The instruction items the student should reopen, or [] when no review
      # is needed.
      def review_items_to_revisit(quiz, user)
        return [] unless user && Gating.player_course?(quiz.context)

        tag, setting = check_setting(quiz)
        return [] unless setting&.retake_review

        last = quiz.quiz_submissions.where(user_id: user).first
        return [] unless last&.completed? && last.finished_at
        return [] if mastered?(quiz, last, setting)

        items = instruction_items_before(tag)
        return [] if items.empty? || reviewed_since?(user, items, last.finished_at)

        items
      end

      private

      def check_setting(quiz)
        tags = quiz.context_module_tags.not_deleted.to_a
        settings = ItemSetting.where(content_tag_id: tags.map(&:id)).index_by(&:content_tag_id)
        tag = tags.find { |t| settings[t.id]&.retake_review } || tags.first
        [tag, tag && settings[tag.id]]
      end

      def mastered?(quiz, submission, setting)
        points = quiz.points_possible.to_f
        return false unless points.positive?

        threshold = setting.mastery_threshold || CourseSetup.new(quiz.context).mastery_threshold
        (submission.kept_score.to_f / points) * 100 >= threshold
      end

      # Instruction items between the previous check (or the start of the
      # module) and this one: the lesson the check is about.
      def instruction_items_before(tag)
        tags = tag.context_module.content_tags.not_deleted.where(position: ...tag.position).order(:position).to_a
        settings = ItemSetting.where(content_tag_id: tags.map(&:id)).index_by(&:content_tag_id)
        role = ->(t) { settings[t.id]&.role || ItemSetting.suggested_role(t) }
        lesson = tags.reverse.take_while { |t| !%w[check pretest].include?(role.call(t)) }
        lesson.reverse.select { |t| role.call(t) == "instruction" }
      end

      def reviewed_since?(user, tags, time)
        ItemTime.where(user_id: user, content_tag_id: tags.map(&:id)).where("last_viewed_at > ?", time).exists? ||
          AssetUserAccess.where(user_id: user, asset_code: tags.filter_map { |t| t.content&.asset_string })
                         .where("last_access > ?", time).exists?
      end
    end
  end
end
