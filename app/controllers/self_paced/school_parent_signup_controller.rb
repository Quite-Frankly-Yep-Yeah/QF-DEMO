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

# The page a parent lands on from the school's flyer (SelfPaced::ParentFlyer):
# the same account-making flow as ParentSignupController, but the code is
# school-wide and not tied to any student. They find and ask for their
# student afterwards (ui/features/self_paced_observer's FindStudent, via
# SelfPaced::LinkRequestsController).
module SelfPaced
  class SchoolParentSignupController < ParentSignupController
    private

    def signup_class
      SchoolParentSignup
    end

    def page_title
      t("Find your student")
    end

    def submit_path
      parent_signup_path(params[:code])
    end
  end
end
