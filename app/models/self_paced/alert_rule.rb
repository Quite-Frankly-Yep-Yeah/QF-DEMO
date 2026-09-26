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

# A rule for when to raise an alert (docs/fork-plan.md §3.3). A rule with no
# course is the school's default; a rule for a course replaces the default for
# that kind in that course. With no rules at all, DEFAULTS apply.
module SelfPaced
  class AlertRule < ApplicationRecord
    self.table_name = "self_paced_alert_rules"

    KINDS = %w[behind stuck max_attempts inactive low_grade].freeze

    # What each threshold counts: days, tries, days or percent.
    DEFAULTS = {
      "behind" => { threshold: 3, enabled: true, notify: true },
      "stuck" => { threshold: 3, enabled: true, notify: true },
      "max_attempts" => { threshold: nil, enabled: true, notify: true },
      "inactive" => { threshold: 3, enabled: true, notify: true },
      "low_grade" => { threshold: 60, enabled: false, notify: true }
    }.freeze

    Effective = Struct.new(:kind, :threshold, :enabled, :notify, keyword_init: true) do
      alias_method :enabled?, :enabled
      alias_method :notify?, :notify
    end

    belongs_to :root_account, class_name: "Account"
    belongs_to :course, optional: true

    validates :kind, inclusion: { in: KINDS }
    validates :threshold,
              numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 365 },
              allow_nil: true
    validates :threshold, presence: true, unless: -> { kind == "max_attempts" }
    validates :threshold, numericality: { less_than_or_equal_to: 100 }, if: -> { kind == "low_grade" }

    before_validation { self.root_account_id ||= course&.root_account_id }

    # kind => Effective for +course+: its own rule, else the school default,
    # else the built-in default.
    def self.effective_for(course)
      rules = where(root_account_id: course.root_account_id)
              .where(course_id: [nil, course.id]).to_a
      KINDS.index_with do |kind|
        rule = rules.find { |r| r.kind == kind && r.course_id } || rules.find { |r| r.kind == kind }
        attrs = rule ? rule.slice(:threshold, :enabled, :notify).symbolize_keys : DEFAULTS.fetch(kind)
        Effective.new(kind:, **attrs)
      end
    end

    def as_json_for_api
      { id: id.to_s, kind:, threshold:, enabled:, notify:, course_id: course_id&.to_s }
    end
  end
end
