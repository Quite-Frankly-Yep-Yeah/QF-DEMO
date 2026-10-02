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

  # Whether the grading queue page and API exist for this viewer: the umbrella
  # is on, and the phase flag is on for the root account or for a course the
  # viewer grades (the flag can be set on a school's sub-account alone).
  def self.queue_enabled?(user, root_account)
    return false unless enabled?(root_account)
    return true if root_account.feature_enabled?(:workflow_grading_queue)

    user.present? && graded_courses(user).any? { |course| feature_enabled?(course, :workflow_grading_queue) }
  end

  # Whether to show the Grading link: the queue is enabled and the user is an
  # account admin or teaches or assists somewhere it is on. Cached for five
  # minutes, like the Students link.
  def self.queue_available?(user, root_account)
    return false unless user && enabled?(root_account)

    Rails.cache.fetch(["teacher_workflow_queue_available", user.global_id, root_account.global_id].cache_key,
                      expires_in: 5.minutes) do
      (root_account.feature_enabled?(:workflow_grading_queue) && AccountUser.active.where(user_id: user.id).exists?) ||
        graded_courses(user).any? { |course| feature_enabled?(course, :workflow_grading_queue) }
    end
  end

  def self.graded_courses(user)
    Course.where(id: user.enrollments.active_or_pending.where(type: GRADER_TYPES).select(:course_id))
          .preload(:account, :root_account)
  end
end
