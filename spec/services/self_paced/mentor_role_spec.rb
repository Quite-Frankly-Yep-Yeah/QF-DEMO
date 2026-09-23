# frozen_string_literal: true

#
# Copyright (C) 2026 - present EXAMPLE contributors
#
# This file is part of EXAMPLE LMS, a modified version of Canvas.
#
# EXAMPLE LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

describe SelfPaced::MentorRole do
  let_once(:root_account) { Account.create! }
  let_once(:school) { root_account.sub_accounts.create!(name: "North High") }
  let_once(:course) { course_factory(account: school, active_all: true) }
  let_once(:mentor) { user_factory(active_all: true) }

  describe ".ensure!" do
    it "creates the Mentor role once, however often it runs" do
      first = described_class.ensure!(root_account)

      expect(described_class.ensure!(root_account)).to eql(first)
      expect(root_account.roles.where(name: "Mentor").count).to be 1
    end

    it "lets a school mentor watch and support students but not grade or edit the course" do
      root_account.enable_feature!(:self_paced)
      school.account_users.create!(user: mentor, role: described_class.ensure!(root_account))

      # a freshly loaded course, as in a real request; the let_once one caches
      # account objects from before the flag was turned on
      fresh_course = Course.find(course.id)
      allowed = %i[self_paced_view_dashboard self_paced_view_live_monitor self_paced_unlock_items view_all_grades]
      denied = %i[manage_grades self_paced_manage_attempts manage_course_content_edit]
      expect(allowed.map { |p| fresh_course.grants_right?(mentor, p) }).to all(be true)
      expect(denied.map { |p| fresh_course.grants_right?(mentor, p) }).to all(be false)
    end
  end
end
