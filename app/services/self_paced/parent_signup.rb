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

# What happens behind the parent sign-up page (SelfPaced::ParentInvite): a
# valid invitation code lets a parent make an account, or an existing account
# take on the student, and links them as an observer. The code is used up when
# it links, and it never works after it expires. It works whether or not the
# school has open self-registration turned on, because the school issued it.
module SelfPaced
  class ParentSignup
    class Invalid < StandardError
      attr_reader :messages

      def initialize(messages)
        @messages = Array(messages)
        super(@messages.to_sentence)
      end
    end

    attr_reader :pairing

    def self.find(code, root_account)
      pairing = ObserverPairingCode.active.find_by(code: code.to_s)
      pairing && new(pairing, root_account)
    end

    def initialize(pairing, root_account)
      @pairing = pairing
      @root_account = root_account
    end

    def student
      pairing.user
    end

    # The student's first name is all the sign-up page says about them.
    def student_first_name
      student.short_name.to_s.split.first || student.name
    end

    # Makes a parent's account and links it. Returns the new pseudonym, so the
    # caller can sign them in.
    def create!(name:, email:, password:, password_confirmation: password)
      email = email.to_s.strip
      raise Invalid, I18n.t("Enter your name.") if name.to_s.strip.blank?
      raise Invalid, I18n.t("Enter a valid email address.") unless EmailAddressValidator.valid?(email)
      raise Invalid, I18n.t("That email already has an account. Log in first, then open this link again to add the student.") if taken?(email)

      user = User.new(name: name.to_s.strip, workflow_state: "registered")
      pseudonym = user.pseudonyms.build(account: @root_account, unique_id: email, password:, password_confirmation:)
      pseudonym.workflow_state = "active"
      channel = user.communication_channels.build(path_type: CommunicationChannel::TYPE_EMAIL, path: email)
      channel.workflow_state = "unconfirmed"

      User.transaction do
        raise Invalid, (user.errors.full_messages + pseudonym.errors.full_messages).uniq unless user.valid? && pseudonym.valid?

        user.save!
        link!(user)
      end
      confirm_email(channel)
      pseudonym
    rescue ActiveRecord::RecordInvalid => e
      raise Invalid, e.record.errors.full_messages
    end

    # Links someone who already has an account.
    def link!(observer)
      raise Invalid, I18n.t("You can't be your own parent.") if observer.id == student.id

      UserObservationLink.create_or_restore(student:, observer:, root_account: @root_account)
      pairing.destroy
    end

    private

    # A failed confirmation email never blocks sign-up; the parent is already in.
    def confirm_email(channel)
      channel.send_confirmation!(@root_account) if channel.persisted?
    rescue => e
      Rails.logger.warn("parent sign-up confirmation email failed: #{e.message}")
    end

    def taken?(email)
      @root_account.pseudonyms.active.by_unique_id(email).exists?
    end
  end
end
