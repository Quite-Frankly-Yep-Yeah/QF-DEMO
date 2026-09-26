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

# A staff-only note about a student (docs/fork-plan.md §2.5, §4). A note
# belongs to the student, not to one class: staff who can read notes in any of
# the student's classes see every note, with the class it was written from.
# Students and observers never see notes.
module SelfPaced
  class StudentNote < ApplicationRecord
    self.table_name = "student_notes"

    MAX_LENGTH = 10_000

    belongs_to :root_account, class_name: "Account"
    belongs_to :student, class_name: "User"
    belongs_to :author, class_name: "User"
    belongs_to :course, optional: true

    validates :body, presence: true, length: { maximum: MAX_LENGTH }
    validates :workflow_state, inclusion: { in: %w[active deleted] }

    before_validation { self.root_account_id ||= course&.root_account_id }

    scope :active, -> { where(workflow_state: "active") }

    def destroy
      update!(workflow_state: "deleted")
    end

    def as_json_for(viewer)
      {
        id: id.to_s,
        body:,
        created_at: created_at.iso8601,
        author: { id: author_id.to_s, name: author.name },
        course: course && { id: course_id.to_s, name: course.name },
        can_delete: author_id == viewer.id
      }
    end
  end
end
