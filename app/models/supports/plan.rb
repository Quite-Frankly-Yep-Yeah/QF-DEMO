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

# A student's 504, IEP or English-learner plan as the classroom sees it
# (docs/teacher-workflow-plan.md §2.1): its type, dates and case manager, and
# the accommodations that come with it. The type, dates and notes are tier 2;
# only the accommodations are shown to teachers.
module Supports
  class Plan < ApplicationRecord
    self.table_name = "support_plans"

    TYPES = %w[iep 504 el other].freeze
    STATES = %w[active archived deleted].freeze
    SOURCES = %w[manual import].freeze

    belongs_to :root_account, class_name: "Account"
    belongs_to :account
    belongs_to :student, class_name: "User"
    belongs_to :case_manager, class_name: "User", optional: true
    belongs_to :created_by, class_name: "User", optional: true
    has_many :accommodations, class_name: "Supports::StudentAccommodation", foreign_key: :support_plan_id, inverse_of: :plan
    has_many :acknowledgements, class_name: "Supports::Acknowledgement", foreign_key: :support_plan_id, inverse_of: :plan

    encrypts :notes

    validates :plan_type, inclusion: { in: TYPES }
    validates :workflow_state, inclusion: { in: STATES }
    validates :source, inclusion: { in: SOURCES }
    validate :dates_in_order

    before_validation { self.root_account_id ||= account&.resolved_root_account_id }
    after_save :assign_case_manager
    # accommodations that act follow the plan's state and dates (Phase 2)
    after_commit :sync_accommodations, if: -> { previous_changes.keys.intersect?(%w[workflow_state start_date end_date]) }

    scope :active, -> { where(workflow_state: "active") }
    scope :not_deleted, -> { where.not(workflow_state: "deleted") }

    def active?
      workflow_state == "active"
    end

    # Accommodations changed, so teachers acknowledge the list again.
    def bump_version!
      self.class.where(id:).update_all(["version = version + 1, updated_at = ?", Time.zone.now])
      reload
    end

    def type_label
      case plan_type
      when "iep" then I18n.t("IEP")
      when "504" then I18n.t("504 plan")
      when "el" then I18n.t("English-learner plan")
      else I18n.t("Other plan")
      end
    end

    private

    def dates_in_order
      return unless start_date && end_date && end_date < start_date

      errors.add(:end_date, I18n.t("must be on or after the start date"))
    end

    def sync_accommodations
      Applier.sync_later(student_id, root_account)
    end

    # The case manager can always reach their own students.
    def assign_case_manager
      return unless case_manager_id && saved_change_to_case_manager_id?

      Caseload.create_or_find_by!(root_account_id:, staff_id: case_manager_id, student_id:)
    end
  end
end
