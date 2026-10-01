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

# Namespace for the teacher workflow tools: the grading queue, follow-ups, the
# student page and progress reports (docs/teacher-workflow-plan.md, Track W).
# Named TeacherWorkflow because the workflow gem owns a top-level Workflow.
module TeacherWorkflow
  UMBRELLA_FLAG = :teacher_workflow

  GRADER_TYPES = %w[TeacherEnrollment TaEnrollment].freeze

  # The feature flags for each phase, in the order they ship.
  PHASE_FLAGS = %i[
    workflow_grading_queue
  ].freeze

  # Whether the teacher workflow tools are on for the root account that owns
  # +context+ (an Account, a Course, or anything else with a root account).
  def self.enabled?(context)
    root_account = context.is_a?(Account) ? context.root_account : context&.root_account
    !!root_account&.feature_enabled?(UMBRELLA_FLAG)
  end

  # Whether a phase flag is on for +context+ (an Account or a Course). Always
  # false while the umbrella flag is off.
  def self.feature_enabled?(context, flag)
    raise ArgumentError, "unknown teacher workflow flag: #{flag}" unless PHASE_FLAGS.include?(flag)
    return false unless enabled?(context)

    account = context.is_a?(Course) ? context.account : context
    account.feature_enabled?(flag)
  end

  # Whether to show the Grading link: the umbrella is on and the user teaches
  # or assists somewhere. Cached for five minutes, like the Students link.
  def self.queue_available?(user, root_account)
    return false unless user && root_account&.feature_enabled?(UMBRELLA_FLAG)

    Rails.cache.fetch(["teacher_workflow_queue_available", user.global_id, root_account.global_id].cache_key,
                      expires_in: 5.minutes) do
      user.enrollments.active_or_pending.where(type: GRADER_TYPES).exists?
    end
  end
end
