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

# How the course player treats one module item (docs/fork-plan.md §2.1).
module SelfPaced
  class ItemSetting < ApplicationRecord
    self.table_name = "module_item_settings"

    ROLES = %w[instruction practice check pretest none].freeze

    belongs_to :content_tag
    belongs_to :course
    belongs_to :root_account, class_name: "Account"
    # the skill this item teaches; mastering it skips the item (docs/fork-plan.md Phase 9)
    belongs_to :learning_outcome, optional: true

    validates :role, inclusion: { in: ROLES }
    validates :mastery_threshold, numericality: { greater_than: 0, less_than_or_equal_to: 100 }, allow_nil: true
    validates :watch_fraction, numericality: { greater_than: 0, less_than_or_equal_to: 1 }, allow_nil: true
    validates :max_attempts, numericality: { greater_than: 0, only_integer: true }, allow_nil: true
    validate :skill_belongs_to_a_lesson_in_this_course

    before_validation { self.root_account_id ||= course&.root_account_id }

    # A skill can only be set on a lesson or practice item, and it has to be one
    # of the course's own skills, so test-out can't reach into another course.
    def skill_belongs_to_a_lesson_in_this_course
      return unless learning_outcome_id

      errors.add(:learning_outcome_id, "can only be set on lessons and practice") unless SelfPaced::TestOut::ROLES.include?(role)
      linked = course&.learning_outcome_links&.active&.where(content_type: "LearningOutcome", content_id: learning_outcome_id)&.exists?
      errors.add(:learning_outcome_id, "isn't a skill in this course") unless linked
    end

    # The role a module item gets before a teacher changes it. (Not
    # "default_role": ActiveRecord uses that name to pick a database role.)
    def self.suggested_role(tag)
      case tag.content_type
      when "ContextModuleSubHeader" then "none"
      when "Quizzes::Quiz" then "check"
      when "Assignment", "DiscussionTopic" then "practice"
      else "instruction"
      end
    end

    # Course copy and export (lib/cc/module_meta.rb, Importers::ContextModuleImporter)
    EXPORTED_ATTRIBUTES = %w[role estimated_minutes mastery_threshold watch_fraction max_attempts retake_review].freeze

    def export_json
      attributes.slice(*EXPORTED_ATTRIBUTES).to_json
    end

    def self.import_from_migration(tag, json)
      data = JSON.parse(json.to_s)
      return unless data.is_a?(Hash) && tag.context.is_a?(Course)

      setting = find_or_initialize_by(content_tag: tag) { |s| s.course = tag.context }
      setting.assign_attributes(data.slice(*EXPORTED_ATTRIBUTES))
      setting.save
    rescue JSON::ParserError
      nil
    end
  end
end
