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

# The account-level "Course Editor" role (docs/fork-plan.md Phase 5b):
# everything a Mentor has, plus editing the school's self-paced courses:
# modules, pages, files, assignments and quizzes (questions included), the
# Course Player setup and the Pacing panel. Editors change content, not
# students: no grading, enrolments, sections, course deletion or account
# settings.
#
#   school.account_users.create!(user: editor, role: SelfPaced::CourseEditorRole.ensure!(root_account))
module SelfPaced
  module CourseEditorRole
    NAME = "Course Editor"

    EDITING = %i[
      read_course_content
      read_course_list
      read_question_banks
      manage_course_content_add
      manage_course_content_edit
      manage_course_content_delete
      manage_assignments_add
      manage_assignments_edit
      manage_assignments_delete
      manage_wiki_create
      manage_wiki_update
      manage_wiki_delete
      manage_files_add
      manage_files_edit
      manage_files_delete
      manage_rubrics
    ].freeze

    PERMISSIONS = (MentorRole::PERMISSIONS + EDITING).freeze

    # Finds or creates the role in +root_account+ with the editor permissions.
    # Safe to run again.
    def self.ensure!(root_account)
      MentorRole.ensure_role!(root_account, NAME, PERMISSIONS)
    end
  end
end
