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

# Namespace for the self-paced mastery platform (docs/fork-plan.md).
module SelfPaced
  UMBRELLA_FLAG = :self_paced

  # The feature flags for each phase, in the order they ship.
  PHASE_FLAGS = %i[
    self_paced_activity_tracking
    self_paced_teacher_dashboard
    self_paced_course_player
    self_paced_pacing
    self_paced_interventions
    self_paced_alerts
    self_paced_reports
    self_paced_observer_view
    self_paced_test_out
  ].freeze

  # Whether the platform is on for the root account that owns +context+
  # (an Account, a Course, or anything else with a root account).
  def self.enabled?(context)
    root_account = context.is_a?(Account) ? context.root_account : context&.root_account
    !!root_account&.feature_enabled?(UMBRELLA_FLAG)
  end

  # Whether a phase flag is on for +context+ (an Account or a Course). Always
  # false while the umbrella flag is off, so a phase can never be turned on by
  # itself.
  def self.feature_enabled?(context, flag)
    raise ArgumentError, "unknown self-paced flag: #{flag}" unless PHASE_FLAGS.include?(flag)
    return false unless enabled?(context)

    # Account-scoped flags don't resolve on a Course (Feature#applies_to_object),
    # so check those against the course's account.
    flag_context = if context.is_a?(Course) && Feature.definitions[flag.to_s].applies_to != "Course"
                     context.account
                   else
                     context
                   end
    flag_context.feature_enabled?(flag)
  end
end
