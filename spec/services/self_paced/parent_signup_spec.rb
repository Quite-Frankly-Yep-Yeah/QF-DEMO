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

describe SelfPaced::ParentSignup do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let(:code) { maya.generate_observer_pairing_code }
  let(:signup) { described_class.find(code.code, course.root_account) }

  describe ".find" do
    it "finds a live code" do
      expect(signup.student).to eq maya
      expect(signup.student_first_name).to eql("Maya")
    end

    it "doesn't find an unknown, used or expired code" do
      expect(described_class.find("nope", course.root_account)).to be_nil

      code.update!(expires_at: 1.minute.ago)
      expect(described_class.find(code.code, course.root_account)).to be_nil
    end
  end

  describe "#create!" do
    def signup_with(**overrides)
      signup.create!(name: "Pat Kim", email: "pat@example.com", password: "longenough1", password_confirmation: "longenough1", **overrides)
    end

    it "makes the parent's account and links them to the student" do
      pseudonym = signup_with

      parent = pseudonym.user
      expect(parent.name).to eql("Pat Kim")
      expect(pseudonym.unique_id).to eql("pat@example.com")
      expect(parent.communication_channels.pluck(:path)).to eql(["pat@example.com"])
      expect(UserObservationLink.active.where(student: maya, observer: parent)).to exist
    end

    it "gives the parent an observer enrollment in the student's class" do
      parent = signup_with.user

      expect(course.observer_enrollments.where(user: parent, associated_user_id: maya.id)).to exist
    end

    it "uses the code up" do
      signup_with

      expect(described_class.find(code.code, course.root_account)).to be_nil
    end

    it "asks for a name and a real email" do
      expect { signup_with(name: " ") }.to raise_error(described_class::Invalid, /name/)
      expect { signup_with(email: "not an email") }.to raise_error(described_class::Invalid, /email/)
    end

    it "asks for a password that matches" do
      expect { signup_with(password_confirmation: "different1") }.to raise_error(described_class::Invalid)
      expect(ObserverPairingCode.active.where(code: code.code)).to exist
      expect(UserObservationLink.where(student: maya)).to be_empty
    end

    it "points someone who already has an account at logging in" do
      user_with_pseudonym(username: "pat@example.com", account: course.root_account)

      expect { signup_with }.to raise_error(described_class::Invalid, /already has an account/)
    end
  end

  describe "#link!" do
    it "links an existing account and uses the code up" do
      parent = user_with_pseudonym(active_all: true, account: course.root_account)
      signup.link!(parent)

      expect(UserObservationLink.active.where(student: maya, observer: parent)).to exist
      expect(described_class.find(code.code, course.root_account)).to be_nil
    end

    it "won't let a student be their own parent" do
      expect { signup.link!(maya) }.to raise_error(described_class::Invalid)
    end
  end
end
