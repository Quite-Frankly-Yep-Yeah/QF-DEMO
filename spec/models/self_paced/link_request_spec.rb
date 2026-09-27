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

describe SelfPaced::LinkRequest do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:root) { course.root_account }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  # with a login, as anyone who signed up from the flyer has
  let_once(:parent) { user_with_pseudonym(active_all: true, name: "Pat Kim", account: root) }
  let_once(:admin) { account_admin_user(account: root) }

  def ask(**overrides)
    described_class.ask!(observer: parent, student: maya, root_account: root, **overrides)
  end

  describe ".ask!" do
    it "records a waiting request with the parent's note" do
      request = ask(note: "  I'm her mother.  ")

      expect(request).to be_pending
      expect(request).to have_attributes(observer: parent, student: maya, root_account: root, note: "I'm her mother.")
    end

    it "leaves a blank note empty" do
      expect(ask(note: "   ").note).to be_nil
    end

    it "won't take a note longer than a text message" do
      expect { ask(note: "x" * 301) }.to raise_error(described_class::Refused, /too long/)
    end

    it "won't let someone ask to follow themselves" do
      expect { described_class.ask!(observer: maya, student: maya, root_account: root) }
        .to raise_error(described_class::Refused, /yourself/)
    end

    it "says so when they already follow the student" do
      UserObservationLink.create_or_restore(student: maya, observer: parent, root_account: root)

      expect { ask }.to raise_error(described_class::Refused, /already follow Maya Lopez/)
    end

    it "says so when they've already asked" do
      ask

      expect { ask }.to raise_error(described_class::Refused, /already asked/)
      expect(described_class.where(observer: parent).count).to eq 1
    end

    it "lets them ask again after being declined" do
      ask.decline!(admin)

      expect { ask }.not_to raise_error
    end

    it "stops one parent asking about a crowd of students" do
      described_class::MAX_PENDING.times do |i|
        described_class.ask!(observer: parent, student: student_in_course(course:, active_all: true, name: "Kid #{i}").user, root_account: root)
      end

      expect { ask }.to raise_error(described_class::Refused, /waiting/)
    end
  end

  describe "#approve!" do
    it "links the parent to the student like an admin would on the People page" do
      request = ask.approve!(admin)

      expect(request.workflow_state).to eql("approved")
      expect(request.decided_by).to eq admin
      expect(request.decided_at).to be_present
      expect(UserObservationLink.active.where(student: maya, observer: parent)).to exist
      expect(course.observer_enrollments.where(user: parent, associated_user_id: maya.id)).to exist
    end

    it "restores a link that was removed before" do
      UserObservationLink.create_or_restore(student: maya, observer: parent, root_account: root).destroy
      ask.approve!(admin)

      expect(UserObservationLink.active.where(student: maya, observer: parent).count).to eq 1
    end

    it "does nothing to a request someone else already answered" do
      request = ask
      request.decline!(admin, "Not a parent of record")
      described_class.find(request.id).approve!(admin)

      expect(request.reload.workflow_state).to eql("declined")
      expect(UserObservationLink.where(student: maya, observer: parent)).to be_empty
    end
  end

  describe "#decline!" do
    it "keeps the reason for the parent and makes no link" do
      request = ask.decline!(admin, "  Please call the office.  ")

      expect(request).to have_attributes(workflow_state: "declined", decided_by: admin, response: "Please call the office.")
      expect(UserObservationLink.where(student: maya, observer: parent)).to be_empty
    end

    it "doesn't need a reason" do
      expect(ask.decline!(admin).response).to be_nil
    end
  end

  describe "#cancel!" do
    it "closes a waiting request" do
      expect(ask.cancel!.workflow_state).to eql("cancelled")
    end

    it "can't take back an answer" do
      request = ask.approve!(admin)

      expect(request.cancel!.workflow_state).to eql("approved")
    end
  end

  describe ".admin_json" do
    it "gives an admin what they need to decide" do
      jordan = student_in_course(course:, active_all: true, name: "Jordan Kim").user
      UserObservationLink.create_or_restore(student: maya, observer: jordan, root_account: root)
      parent.communication_channels.email.first.update!(path: "pat@example.com")
      ask(note: "Her mom")

      row = described_class.admin_json(described_class.pending).first

      expect(row).to include(status: "pending", note: "Her mom", decided_by: nil)
      expect(row[:observer]).to include(name: "Pat Kim", email: "pat@example.com")
      expect(row[:student]).to include(name: "Maya Lopez", classes: ["Algebra 1"], parents: 1)
    end
  end
end
