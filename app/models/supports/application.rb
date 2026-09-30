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

# One time the app acted on a student's accommodation
# (docs/teacher-workflow-plan.md Phase 2). Append-only: rows are never
# changed, only purged with the student.
module Supports
  class Application < ApplicationRecord
    self.table_name = "accommodation_applications"

    KINDS = %w[extended_time extra_attempts pacing display].freeze

    belongs_to :root_account, class_name: "Account"
    belongs_to :student, class_name: "User"
    belongs_to :student_accommodation, class_name: "Supports::StudentAccommodation", optional: true
    belongs_to :course, optional: true
    belongs_to :context, polymorphic: [:user,
                                       { pacing_plan: "SelfPaced::PacingPlan",
                                         quiz_submission: "Quizzes::QuizSubmission" }]

    validates :kind, inclusion: { in: KINDS }

    before_update { raise ActiveRecord::ReadOnlyRecord }

    scope :since, ->(time) { where(created_at: time..) }

    def self.record!(accommodation, kind:, context:, course: nil, details: {})
      create!(root_account_id: accommodation.root_account_id,
              student_id: accommodation.student_id,
              student_accommodation: accommodation,
              course:,
              kind:,
              context:,
              details:)
    end

    # What a case manager reads: no plan details, just what changed where.
    def as_api_json(course_names = {})
      {
        id: id.to_s,
        kind:,
        accommodation_id: student_accommodation_id&.to_s,
        course: course_id && { id: course_id.to_s, name: course_names[course_id] },
        context_type:,
        context_id: context_id.to_s,
        details:,
        created_at: created_at.iso8601
      }
    end
  end
end
