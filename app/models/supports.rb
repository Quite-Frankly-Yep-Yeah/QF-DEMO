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

# Namespace for student supports: 504, IEP and English-learner plans and the
# need-to-know rules that protect them (docs/teacher-workflow-plan.md, Track S).
module Supports
  UMBRELLA_FLAG = :student_supports

  # The feature flags for each phase, in the order they ship.
  PHASE_FLAGS = %i[
    supports_plans
    supports_accommodations_apply
  ].freeze

  # Per-school choice between reading plans from the district's system and
  # keeping them here (docs/teacher-workflow-plan.md §2.1, Q1).
  RECORD_MODES = %w[classroom_layer system_of_record].freeze
  DEFAULT_RECORD_MODE = "classroom_layer"

  # The three protection tiers (§2.2).
  TIERS = {
    accommodations: 1,
    plan_details: 2,
    documents: 3
  }.freeze

  # Whether supports are on for the root account that owns +context+ (an
  # Account, a Course, or anything else with a root account).
  def self.enabled?(context)
    root_account = context.is_a?(Account) ? context.root_account : context&.root_account
    !!root_account&.feature_enabled?(UMBRELLA_FLAG)
  end

  # Whether a phase flag is on for +context+ (an Account or a Course). Always
  # false while the umbrella flag is off.
  def self.feature_enabled?(context, flag)
    raise ArgumentError, "unknown supports flag: #{flag}" unless PHASE_FLAGS.include?(flag)
    return false unless enabled?(context)

    account = context.is_a?(Course) ? context.account : context
    account.feature_enabled?(flag)
  end

  # The record mode for +account+, inherited from its parent accounts.
  def self.record_mode(account)
    mode = account&.supports_record_mode&.dig(:value)
    RECORD_MODES.include?(mode) ? mode : DEFAULT_RECORD_MODE
  end

  def self.system_of_record?(account)
    record_mode(account) == "system_of_record"
  end
end
