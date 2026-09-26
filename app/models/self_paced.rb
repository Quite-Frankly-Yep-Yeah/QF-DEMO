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
    self_paced_course_view
    self_paced_quiz_reader
    self_paced_student_home
    self_paced_alerts
    self_paced_reports
    self_paced_observer_view
    self_paced_test_out
    self_paced_admin_catalog
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

  # Whether +user+ gets the "Students" item in the global navigation: the
  # platform is on and they can open the dashboard for at least one course or
  # school account. Cached briefly because it's checked on every page.
  def self.dashboard_available?(user, root_account)
    return false unless user && root_account&.feature_enabled?(UMBRELLA_FLAG)

    Rails.cache.fetch(["self_paced_dashboard_available", user.global_id, root_account.global_id].cache_key,
                      expires_in: 5.minutes) do
      DashboardScope.new(user).allowed?
    end
  end

  # Whether the Courses page is the admin course catalog on this root account.
  def self.course_catalog?(root_account)
    !!root_account && feature_enabled?(root_account, :self_paced_admin_catalog)
  end

  # Whether +user+ can use the catalog: they can list the courses of the root
  # account, which an account admin can and a teacher or student can't.
  def self.course_catalog_admin?(user, root_account)
    !!user && !!root_account && root_account.grants_right?(user, :read_course_list)
  end

  # Whether the Courses item is hidden from +user+ in the global navigation.
  def self.hide_courses_nav?(user, root_account)
    course_catalog?(root_account) && !course_catalog_admin?(user, root_account)
  end
end
