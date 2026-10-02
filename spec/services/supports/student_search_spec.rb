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

describe Supports::StudentSearch do
  let_once(:root_account) { Account.default }
  let_once(:admin) { account_admin_user(account: root_account, name: "Ada Admin") }
  let_once(:course) { course_factory(active_all: true) }
  let_once(:enrolled) { student_in_course(course:, active_all: true, name: "Pat Enrolled").user }

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
  end

  def login_for(user, unique_id:, sis_user_id: nil, account: root_account)
    user.pseudonyms.create!(unique_id:, sis_user_id:, account:)
    user
  end

  def case_manager
    role = custom_account_role("Case manager", account: root_account)
    root_account.role_overrides.create!(permission: "supports_manage_plans", role:, enabled: true)
    user_factory(active_all: true).tap { |u| root_account.account_users.create!(user: u, role:) }
  end

  describe "for someone who manages every student's plans" do
    let(:search) { described_class.new(admin, root_account) }

    it "is allowed and finds an enrolled student by name" do
      expect(search).to be_allowed
      expect(search.search("Enrolled")).to eq [{ id: enrolled.id.to_s, name: "Pat Enrolled", sis_user_id: nil }]
    end

    it "finds a new student with a login but no enrollment, by name, SIS ID or login, from the start" do
      newbie = login_for(user_factory(active_all: true, name: "Nicholas Harris"), unique_id: "ncharri448@example.com", sis_user_id: "20094448")
      expect(search.search("Nicholas").pluck(:id)).to eq [newbie.id.to_s]
      expect(search.search("2009")).to eq [{ id: newbie.id.to_s, name: "Nicholas Harris", sis_user_id: "20094448" }]
      expect(search.search("NCHARRI").pluck(:id)).to eq [newbie.id.to_s]
      expect(search.search("harri448")).to eq []
    end

    it "doesn't offer staff, someone at another school, or someone without a login or enrollment" do
      teacher = teacher_in_course(course:, active_all: true).user
      login_for(teacher, unique_id: "teach@example.com", sis_user_id: "T-1")
      other_root = Account.create!(name: "Elsewhere")
      login_for(user_factory(active_all: true, name: "Olive Elsewhere"), unique_id: "olive@example.com", sis_user_id: "9999", account: other_root)
      user_factory(active_all: true, name: "Nora Nologin")
      expect(search.search("T-1")).to eq []
      expect(search.search("9999")).to eq []
      expect(search.search("Nora")).to eq []
      expect(search.scope.pluck(:id)).to eq [enrolled.id]
    end

    it "needs two characters and keeps its limit" do
      expect(search.search("a")).to eq []
      22.times { |i| login_for(user_factory(active_all: true, name: "Many Student #{i}"), unique_id: "many#{i}@example.com") }
      expect(search.search("Many Student").size).to eq 20
      expect(search.search("Many Student", limit: 5).size).to eq 5
    end
  end

  describe "for a case manager with a caseload" do
    let_once(:manager) { case_manager }
    let_once(:mine) { login_for(user_factory(active_all: true, name: "Casey Caseload"), unique_id: "casey@example.com", sis_user_id: "C-1") }
    let(:search) { described_class.new(manager, root_account) }

    before do
      Supports::Caseload.create!(root_account:, staff_id: manager.id, student_id: mine.id)
    end

    it "is allowed, and scope and search are the caseload only" do
      expect(search).to be_allowed
      expect(search.scope.pluck(:id)).to eq [mine.id]
      expect(search.search("Casey").pluck(:id)).to eq [mine.id.to_s]
      expect(search.search("Enrolled")).to eq []
      expect(search.search("C-1").pluck(:sis_user_id)).to eq ["C-1"]
    end

    it "never returns a student from another school" do
      other_root = Account.create!(name: "Elsewhere")
      stranger = login_for(user_factory(active_all: true, name: "Casey Stranger"), unique_id: "cs@example.com", account: other_root)
      Supports::Caseload.create!(root_account: other_root, staff_id: manager.id, student_id: stranger.id)
      expect(search.search("Casey").pluck(:id)).to eq [mine.id.to_s]
    end
  end

  describe "who is not allowed" do
    it "refuses a case manager with no caseload" do
      search = described_class.new(case_manager, root_account)
      expect(search).not_to be_allowed
      expect(search.scope).to be_empty
      expect(search.search("Enrolled")).to eq []
    end

    it "refuses a teacher, even one with a caseload row" do
      teacher = teacher_in_course(course:, active_all: true).user
      Supports::Caseload.create!(root_account:, staff_id: teacher.id, student_id: enrolled.id)
      expect(described_class.new(teacher, root_account)).not_to be_allowed
    end

    it "refuses a student and nobody" do
      expect(described_class.new(enrolled, root_account)).not_to be_allowed
      expect(described_class.new(nil, root_account)).not_to be_allowed
    end
  end
end
