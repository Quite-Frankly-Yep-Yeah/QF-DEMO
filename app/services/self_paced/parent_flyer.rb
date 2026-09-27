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

# The school's parent sign-up flyer (docs/fork-plan.md Phase 8): one printed
# page with a QR code that any parent can scan to make an account. Unlike a
# ParentInvite it isn't tied to a student and doesn't run out, so the code in
# it is a school-wide secret. An admin can reset it to kill every flyer already
# handed out. An account made this way sees nothing until the school links it
# to a student (SelfPaced::LinkRequest).
module SelfPaced
  module ParentFlyer
    PATH = "/parents/signup"
    CODE_LENGTH = 12
    SETTING = :self_paced_parent_signup_code

    # The current code, made the first time it's needed.
    def self.code(root_account)
      root_account.settings[SETTING].presence || reset!(root_account)
    end

    # Makes a new code. Every flyer printed with the old one stops working.
    def self.reset!(root_account)
      code = SecureRandom.alphanumeric(CODE_LENGTH).downcase
      root_account.settings[SETTING] = code
      root_account.save!
      code
    end

    def self.valid_code?(root_account, code)
      current = root_account.settings[SETTING].to_s
      current.present? && ActiveSupport::SecurityUtils.secure_compare(current, code.to_s)
    end

    # What the flyer needs. +base_url+ is the address the admin is using, so a
    # flyer made on the school's own address points there.
    def self.build(root_account, base_url)
      url = "#{base_url.to_s.chomp("/")}#{PATH}/#{code(root_account)}"
      { school_name: root_account.name, url:, qr_svg: ParentInvite.qr_svg(url) }
    end
  end
end
