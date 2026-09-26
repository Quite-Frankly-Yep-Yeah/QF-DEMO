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

# A per-student exception to gating (docs/fork-plan.md §2.1, §2.5):
#
# - unlock:   the student may open the item even though gating would lock it
# - exempt:   the item's requirement counts as met and it drops out of pacing
# - complete: the item's requirement counts as met
#
# Only honoured in courses with the course player on.
module SelfPaced
  class ItemOverride < ApplicationRecord
    self.table_name = "module_item_student_overrides"

    KINDS = %w[unlock exempt complete].freeze
    MEETS_REQUIREMENT = %w[exempt complete].freeze

    belongs_to :content_tag
    belongs_to :user
    belongs_to :course
    belongs_to :root_account, class_name: "Account"
    belongs_to :created_by, class_name: "User", optional: true
    # set when a test-out made the exemption: the skill the student mastered
    belongs_to :learning_outcome, optional: true

    validates :kind, inclusion: { in: KINDS }

    before_validation do
      self.course_id ||= content_tag&.context_id if content_tag&.context_type == "Course"
      self.root_account_id ||= course&.root_account_id
    end

    after_commit :reevaluate_progression

    scope :active, -> { where(workflow_state: "active") }

    # {content_tag_id => Set of kinds} for one student in one course, once per
    # request. Empty unless the course player is on.
    def self.for(user_id, course)
      return {} unless user_id && course.is_a?(Course) && SelfPaced.feature_enabled?(course, :self_paced_course_player)

      RequestCache.cache("self_paced_item_overrides", user_id, course.id) do
        active.where(user_id:, course_id: course.id).pluck(:content_tag_id, :kind)
              .each_with_object(Hash.new { |h, k| h[k] = Set.new }) { |(tag_id, kind), result| result[tag_id] << kind }
      end
    end

    def self.unlocked?(user_id, course, tag_id)
      self.for(user_id, course)[tag_id]&.include?("unlock") || false
    end

    def self.meets_requirement?(user_id, course, tag_id)
      kinds = self.for(user_id, course)[tag_id]
      kinds.present? && kinds.intersect?(MEETS_REQUIREMENT)
    end

    def destroy
      update!(workflow_state: "deleted")
    end

    private

    # Overrides change what counts as done, so recompute the student's module
    # progress (outside the request cache that may hold the old overrides).
    def reevaluate_progression
      RequestCache.clear
      content_tag&.context_module&.evaluate_for(user)
    end
  end
end
