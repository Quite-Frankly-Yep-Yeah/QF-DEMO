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

describe SelfPaced do
  let(:account) { Account.default }
  let(:admin) { account_admin_user(account:) }
  let(:teacher) { course_with_teacher(account:).user }
  let(:student) { course_with_student(account:).user }

  def enable_catalog
    account.enable_feature!(:self_paced)
    account.enable_feature!(:self_paced_admin_catalog)
  end

  describe ".course_catalog?" do
    it "is off until the umbrella and the catalog flag are both on" do
      expect(SelfPaced.course_catalog?(account)).to be false

      account.enable_feature!(:self_paced_admin_catalog)
      expect(SelfPaced.course_catalog?(account)).to be false

      account.enable_feature!(:self_paced)
      expect(SelfPaced.course_catalog?(account)).to be true
    end
  end

  describe ".course_catalog_admin?" do
    it "is true for an account admin and false for a teacher, a student or no one" do
      expect(SelfPaced.course_catalog_admin?(admin, account)).to be true
      expect(SelfPaced.course_catalog_admin?(teacher, account)).to be false
      expect(SelfPaced.course_catalog_admin?(student, account)).to be false
      expect(SelfPaced.course_catalog_admin?(nil, account)).to be false
    end
  end

  describe ".hide_courses_nav?" do
    it "hides nothing while the catalog is off" do
      expect(SelfPaced.hide_courses_nav?(student, account)).to be false
    end

    it "hides the Courses item from everyone but admins once the catalog is on" do
      enable_catalog
      expect(SelfPaced.hide_courses_nav?(student, account)).to be true
      expect(SelfPaced.hide_courses_nav?(teacher, account)).to be true
      expect(SelfPaced.hide_courses_nav?(admin, account)).to be false
    end
  end
end
