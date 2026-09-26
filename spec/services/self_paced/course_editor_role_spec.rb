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

describe SelfPaced::CourseEditorRole do
  let_once(:root_account) { Account.create! }
  let_once(:school) { root_account.sub_accounts.create!(name: "North High") }
  let_once(:course) { course_factory(account: school, active_all: true) }
  let_once(:editor) { user_factory(active_all: true) }

  describe ".ensure!" do
    it "creates the Course Editor role once, however often it runs" do
      first = described_class.ensure!(root_account)

      expect(described_class.ensure!(root_account)).to eql(first)
      expect(root_account.roles.where(name: "Course Editor").count).to be 1
    end

    it "lets an editor support students and edit the course, but not grade or change enrolments" do
      root_account.enable_feature!(:self_paced)
      school.account_users.create!(user: editor, role: described_class.ensure!(root_account))

      # freshly loaded, as in a request (see mentor_role_spec)
      fresh_course = Course.find(course.id)
      allowed = %i[self_paced_view_dashboard
                   self_paced_unlock_items
                   view_all_grades
                   send_messages
                   manage_course_content_edit
                   manage_assignments_edit
                   manage_wiki_update
                   manage_files_add]
      denied = %i[manage_grades manage_students manage_sections_add manage_courses_delete self_paced_manage_attempts]
      expect(allowed.index_with { |p| fresh_course.grants_right?(editor, p) }).to eql(allowed.index_with(true))
      expect(denied.index_with { |p| fresh_course.grants_right?(editor, p) }).to eql(denied.index_with(false))
      expect(Account.find(school.id).grants_right?(editor, :manage_account_settings)).to be false
    end

    it "lets an editor change a module and a quiz's questions" do
      root_account.enable_feature!(:self_paced)
      school.account_users.create!(user: editor, role: described_class.ensure!(root_account))
      fresh_course = Course.find(course.id)
      context_module = fresh_course.context_modules.create!(name: "Unit 1")
      quiz = fresh_course.quizzes.create!(title: "Check 1.1")

      expect(context_module.grants_right?(editor, :update)).to be true
      expect(quiz.grants_right?(editor, :update)).to be true
    end
  end
end
