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

describe SelfPaced::SchoolParentSignup do
  let(:root) { Account.default }
  let(:code) { SelfPaced::ParentFlyer.code(root) }
  let(:signup) { described_class.find(code, root) }

  describe ".find" do
    it "finds the school's current code and no other" do
      expect(signup).to be_a(described_class)
      expect(described_class.find("nope", root)).to be_nil

      SelfPaced::ParentFlyer.reset!(root)
      expect(described_class.find(code, Account.find(root.id))).to be_nil
    end

    it "says nothing about any student" do
      expect(signup.student).to be_nil
      expect(signup.student_first_name).to be_nil
    end
  end

  describe "#create!" do
    def signup_with(**overrides)
      signup.create!(name: "Pat Kim", email: "pat@example.com", password: "longenough1", password_confirmation: "longenough1", **overrides)
    end

    it "makes the parent's account, tied to no one" do
      parent = signup_with.user

      expect(parent.name).to eql("Pat Kim")
      expect(parent.communication_channels.pluck(:path)).to eql(["pat@example.com"])
      expect(UserObservationLink.where(observer: parent)).to be_empty
    end

    it "marks the account as a parent's, so they land on the page for finding their student" do
      parent = signup_with.user

      expect(SelfPaced::ObserverView.parent_account?(parent)).to be true
      expect(parent.reload.preferences[described_class::PARENT_PREFERENCE]).to be true
    end

    it "can be used again by the next parent, since the flyer is for everyone" do
      signup_with
      expect { signup_with(email: "sam@example.com") }.not_to raise_error
    end

    it "asks for a name, a real email and a password that matches" do
      expect { signup_with(name: " ") }.to raise_error(SelfPaced::ParentSignup::Invalid, /name/)
      expect { signup_with(email: "not an email") }.to raise_error(SelfPaced::ParentSignup::Invalid, /email/)
      expect { signup_with(password_confirmation: "different1") }.to raise_error(SelfPaced::ParentSignup::Invalid)
    end

    it "points someone who already has an account at logging in" do
      user_with_pseudonym(username: "pat@example.com", account: root)

      expect { signup_with }.to raise_error(SelfPaced::ParentSignup::Invalid, /already has an account/)
    end
  end

  describe "#link!" do
    it "marks an existing account as a parent's without linking it to anyone" do
      parent = user_with_pseudonym(active_all: true, account: root)
      signup.link!(parent)

      expect(parent.reload.preferences[described_class::PARENT_PREFERENCE]).to be true
      expect(UserObservationLink.where(observer: parent)).to be_empty
    end
  end
end
