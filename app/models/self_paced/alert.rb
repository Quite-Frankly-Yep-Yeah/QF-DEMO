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

# An alert for one student in one course: raised by SelfPaced::AlertEvaluator
# when a rule's condition becomes true, resolved when it stops being true, or
# dismissed by staff (docs/fork-plan.md §3.3). Only one is open at a time for a
# student, course and kind.
module SelfPaced
  class Alert < ApplicationRecord
    self.table_name = "self_paced_alerts"

    STATES = %w[open resolved dismissed].freeze

    belongs_to :root_account, class_name: "Account"
    belongs_to :course
    belongs_to :student, class_name: "User"
    belongs_to :content_tag, optional: true
    belongs_to :dismissed_by, class_name: "User", optional: true

    validates :kind, inclusion: { in: AlertRule::KINDS }
    validates :workflow_state, inclusion: { in: STATES }

    scope :currently_open, -> { where(workflow_state: "open") }

    before_validation { self.root_account_id ||= course&.root_account_id }

    # Notification templates and suppression settings read the context.
    def context
      course
    end

    # A sentence for staff: what is wrong and how bad.
    def description
      case kind
      when "behind" then I18n.t("%{days} days behind their pace", days: detail["days_behind"].to_i)
      when "stuck" then I18n.t("%{tries} tries on the same item", tries: detail["attempts"].to_i)
      when "max_attempts" then I18n.t("Out of tries on an item")
      when "inactive" then I18n.t("No activity for %{days} days", days: detail["days_inactive"].to_i)
      when "low_grade" then I18n.t("Grade of %{score}% is below %{threshold}%", score: detail["score"].to_f.round, threshold: detail["threshold"].to_i)
      end
    end

    def open?
      workflow_state == "open"
    end

    def resolve!(now = Time.zone.now)
      update!(workflow_state: "resolved", resolved_at: now)
    end

    def dismiss!(user, now = Time.zone.now)
      update!(workflow_state: "dismissed", resolved_at: now, dismissed_by: user)
    end

    def as_json_for_api
      {
        id: id.to_s,
        kind:,
        opened_at: opened_at.iso8601,
        detail:,
        student: { id: student_id.to_s, name: student.name },
        course: { id: course_id.to_s, name: course.name },
        item: content_tag && { id: content_tag_id.to_s, title: content_tag.title }
      }
    end
  end
end
