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

describe Supports::UserData do
  let_once(:root_account) { Account.default }
  let_once(:staff) { user_factory }
  let_once(:student) { user_factory }
  let_once(:viewer) { user_factory }

  def log_view(viewer, student)
    Supports::AccessLog.record!(viewer:, student:, tier: 1, subject: :accommodations, root_account:)
  end

  describe ".purge" do
    it "removes the student's caseload rows and access log, and keeps what they viewed as staff" do
      Supports::Caseload.create!(root_account:, staff:, student:)
      log_view(viewer, student)
      log_view(student, user_factory)

      described_class.purge(student.id)

      expect(Supports::Caseload.where(student:)).to be_empty
      expect(Supports::AccessLog.where(student:)).to be_empty
      expect(Supports::AccessLog.where(viewer: student).count).to be 1
    end
  end

  describe ".merge" do
    let(:target) { user_factory }

    it "moves caseload rows and log rows to the target user" do
      Supports::Caseload.create!(root_account:, staff:, student:)
      log_view(viewer, student)

      described_class.merge(student, target)

      expect(Supports::Caseload.assigned?(staff, target, root_account)).to be true
      expect(Supports::AccessLog.where(student: target).count).to be 1
    end

    it "drops a log row the target already has for the same hour" do
      log_view(viewer, student)
      log_view(viewer, target)

      described_class.merge(student, target)

      expect(Supports::AccessLog.where(student: target).count).to be 1
      expect(Supports::AccessLog.where(student:)).to be_empty
    end
  end
end
