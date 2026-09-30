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

# One accommodation on a student's plan (docs/teacher-workflow-plan.md §2.3):
# the catalog item, its parameters, dates, which courses it covers and a note
# for teachers. This is the tier 1 record the student's teachers see.
module Supports
  class StudentAccommodation < ApplicationRecord
    self.table_name = "student_accommodations"

    belongs_to :root_account, class_name: "Account"
    belongs_to :plan, class_name: "Supports::Plan", foreign_key: :support_plan_id, inverse_of: :accommodations
    belongs_to :student, class_name: "User"
    belongs_to :accommodation_type, class_name: "Supports::AccommodationType", inverse_of: :student_accommodations

    encrypts :teacher_note

    validates :workflow_state, inclusion: { in: %w[active deleted] }
    validate :parameters_valid
    validate :dates_in_order

    before_validation do
      self.root_account_id ||= plan&.root_account_id
      self.student_id ||= plan&.student_id
      self.course_ids = Array(course_ids).compact_blank.map(&:to_i).uniq.sort
    end

    # accommodations that act are applied to existing work (Phase 2)
    after_commit { Applier.sync_later(student_id, root_account) }

    scope :active, -> { where(workflow_state: "active") }

    # In effect on +date+, on an active plan.
    scope :current, lambda { |date = Time.zone.today|
      active
        .where("student_accommodations.start_date IS NULL OR student_accommodations.start_date <= ?", date)
        .where("student_accommodations.end_date IS NULL OR student_accommodations.end_date >= ?", date)
        .joins(:plan).where(support_plans: { workflow_state: "active" })
    }

    def kind
      accommodation_type.kind
    end

    def all_courses?
      course_ids.empty?
    end

    def applies_to_course?(course_id)
      all_courses? || course_ids.include?(course_id.to_i)
    end

    def parameters_text
      AccommodationType.parameters_text(kind, parameters)
    end

    # What a teacher sees: no plan type, no plan dates.
    def teacher_json(course_names = {})
      {
        id:,
        name: accommodation_type.name,
        kind:,
        details: parameters_text,
        instructions: accommodation_type.instructions,
        teacher_note:,
        courses: all_courses? ? nil : course_ids.map { |id| { id:, name: course_names[id] } },
        start_date: start_date&.iso8601,
        end_date: end_date&.iso8601,
        last_verified_at: last_verified_at&.iso8601
      }
    end

    def editor_json
      teacher_json.merge(
        accommodation_type_id:,
        parameters:,
        course_ids:,
        workflow_state:
      )
    end

    private

    def parameters_valid
      return unless accommodation_type

      AccommodationType.parameter_errors(accommodation_type.kind, parameters).each { |message| errors.add(:parameters, message) }
    end

    def dates_in_order
      return unless start_date && end_date && end_date < start_date

      errors.add(:end_date, I18n.t("must be on or after the start date"))
    end
  end
end
