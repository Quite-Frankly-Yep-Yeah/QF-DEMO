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

# Sign-up from the school's flyer (SelfPaced::ParentFlyer): the same account
# making as ParentSignup, but for a parent who hasn't been tied to a student
# yet. Nothing is linked here. The parent picks their student afterwards and
# the school approves (SelfPaced::LinkRequest).
module SelfPaced
  class SchoolParentSignup < ParentSignup
    # Set on the accounts made here, so the parent's home page is the one that
    # helps them find their student even before they follow anyone.
    PARENT_PREFERENCE = :self_paced_parent

    def self.find(code, root_account)
      new(root_account) if ParentFlyer.valid_code?(root_account, code)
    end

    def initialize(root_account) # rubocop:disable Lint/MissingSuper
      @root_account = root_account
    end

    def student
      nil
    end

    def student_first_name
      nil
    end

    def attach!(user)
      self.class.mark_as_parent!(user)
    end

    # Someone who already has an account and opens the flyer's link: nothing to
    # link, but their home page becomes the parent's.
    def link!(observer)
      self.class.mark_as_parent!(observer)
    end

    def self.mark_as_parent!(user)
      return if user.preferences[PARENT_PREFERENCE]

      user.preferences[PARENT_PREFERENCE] = true
      user.save!
    end
  end
end
