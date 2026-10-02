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

describe Supports::StudentMatcher do
  let_once(:root_account) { Account.default }
  let_once(:admin) { account_admin_user(account: root_account) }

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
  end

  def make_student(name, sis: nil, login: nil, account: root_account)
    user_factory(active_all: true, name:).tap do |user|
      user.pseudonyms.create!(unique_id: login || "#{name.parameterize}-#{user.id}@example.com", sis_user_id: sis, account:)
    end
  end

  let(:matcher) { described_class.new(admin, root_account) }

  def match(name: nil, student_id: nil, by: matcher)
    by.call(name:, student_id:)
  end

  describe "a confident match" do
    it "is the one student whose SIS user ID is on the document, when the name agrees or is absent" do
      pat = make_student("Pat Student", sis: "20094448")
      make_student("Sam Other", sis: "1111")
      expect(match(student_id: "20094448")).to have_attributes(state: "confident", student_id_on_doc: "20094448")
      result = match(name: "Student, Pat", student_id: " 20094448 ")
      expect(result.state).to eq "confident"
      expect(result.candidates).to eq [{ "id" => pat.id.to_s, "name" => "Pat Student", "sis_user_id" => "20094448", "reason" => "id" }]
    end

    it "matches the login ID too" do
      pat = make_student("Pat Student", login: "pat.s@example.com")
      expect(match(student_id: "PAT.S@example.com").candidates.pluck("id")).to eq [pat.id.to_s]
    end

    it "is the one student with exactly the name, when no ID is on the document" do
      pat = make_student("Pat Student")
      make_student("Sam Student")
      result = match(name: "student, PAT")
      expect(result.state).to eq "confident"
      expect(result.candidates.first).to include("id" => pat.id.to_s, "reason" => "name")
    end
  end

  describe "never confident when it could be wrong" do
    it "is ambiguous when two students share the exact name" do
      make_student("Pat Student", sis: "1")
      make_student("Pat Student", sis: "2")
      result = match(name: "Pat Student")
      expect(result.state).to eq "ambiguous"
      expect(result.candidates.pluck("reason")).to eq %w[name name]
    end

    it "is ambiguous when the ID names one student and the name another" do
      a = make_student("Ann Alpha", sis: "A-1")
      b = make_student("Bo Beta", sis: "B-1")
      result = match(name: "Bo Beta", student_id: "A-1")
      expect(result.state).to eq "ambiguous"
      expect(result.candidates).to include(a_hash_including("id" => a.id.to_s, "reason" => "id"), a_hash_including("id" => b.id.to_s, "reason" => "name"))
      expect(result.candidates.first["id"]).to eq a.id.to_s
    end

    it "is ambiguous when the ID matches a student whose name has nothing to do with the document's" do
      make_student("Ann Alpha", sis: "A-1")
      expect(match(name: "Zed Zulu", student_id: "A-1").state).to eq "ambiguous"
    end

    it "is ambiguous when two students share the ID on the document" do
      make_student("Ann Alpha", sis: "A-1", login: "a1@example.com")
      make_student("Bo Beta", login: "A-1")
      expect(match(student_id: "A-1").state).to eq "ambiguous"
    end

    it "is ambiguous when an ID is printed that nobody has, even if the name matches one student" do
      make_student("Pat Student")
      expect(match(name: "Pat Student", student_id: "NOPE-1").state).to eq "ambiguous"
    end

    it "is ambiguous for several partial matches, and for a single partial match" do
      make_student("Pat Student")
      make_student("Pat Student Jr")
      expect(match(name: "Pat").state).to eq "ambiguous"
      expect(match(name: "Pat Student Jr Q").state).to eq "ambiguous"
    end
  end

  describe "none" do
    it "is none when nothing matches, and for a blank name and ID" do
      make_student("Pat Student", sis: "1")
      expect(match(name: "Zed Zulu", student_id: "999").state).to eq "none"
      result = match(name: "  ", student_id: nil)
      expect(result.state).to eq "none"
      expect(result.candidates).to eq []
    end
  end

  describe "ranking" do
    it "ranks an ID match, then an exact name, then a partial name" do
      partial = make_student("Pat Student Longname")
      exact = make_student("Pat Student", sis: "S-1")
      by_id = make_student("Zed Zulu", sis: "Z-1")
      result = match(name: "Pat Student", student_id: "Z-1")
      expect(result.candidates.pluck("id")).to eq([by_id, exact, partial].map { |u| u.id.to_s })
      expect(result.candidates.pluck("reason")).to eq %w[id name partial]
    end

    it "ignores name order, case and punctuation, and ranks a partial below an exact name" do
      exact = make_student("Pat Student")
      partial = make_student("Patricia Pat Student")
      result = match(name: "STUDENT, pat.")
      expect(result.candidates.pluck("id")).to eq [exact.id.to_s, partial.id.to_s]
    end

    it "offers at most 5 candidates" do
      8.times { |i| make_student("Pat Student #{%w[A B C D E F G H][i]}") }
      expect(match(name: "Pat").candidates.size).to eq 5
    end
  end

  describe "when many students share a word with the document's name" do
    it "finds the exact name even when it sorts after many others" do
      stub_const("Supports::StudentMatcher::POOL", 3)
      5.times { |i| make_student("Lee Ann#{i}") }
      exact = make_student("Zed Lee")
      result = match(name: "Lee Zed")
      expect(result.state).to eq "confident"
      expect(result.candidates.pluck("id")).to eq [exact.id.to_s]
    end

    it "is ambiguous, never confident, when more students than it can look at contain every word" do
      stub_const("Supports::StudentMatcher::POOL", 3)
      make_student("Zed Lee")
      4.times { |i| make_student("Aaron#{i} Zed Lee") } # sort first and fill the pool
      result = match(name: "Lee Zed")
      expect(result.state).to eq "ambiguous"
    end

    it "is not fooled by a different order of the same words" do
      ann = make_student("Ann Lee")
      make_student("Lee Ann Jr")
      expect(match(name: "Lee, Ann").candidates.first).to include("id" => ann.id.to_s, "reason" => "name")
    end
  end

  describe "who it may offer" do
    it "never offers a student at another school, or staff" do
      other_root = Account.create!(name: "Elsewhere")
      make_student("Pat Student", sis: "7", account: other_root)
      expect(match(name: "Pat Student", student_id: "7")).to have_attributes(state: "none", candidates: [])
    end

    it "offers a case manager only students on their caseload" do
      role = custom_account_role("Case manager", account: root_account)
      root_account.role_overrides.create!(permission: "supports_manage_plans", role:, enabled: true)
      manager = user_factory(active_all: true).tap { |u| root_account.account_users.create!(user: u, role:) }
      mine = make_student("Pat Student", sis: "M-1")
      make_student("Pat Student", sis: "N-1")
      Supports::Caseload.create!(root_account:, staff_id: manager.id, student_id: mine.id)

      by_manager = described_class.new(manager, root_account)
      result = match(name: "Pat Student", by: by_manager)
      expect(result.state).to eq "confident"
      expect(result.candidates.pluck("id")).to eq [mine.id.to_s]
      expect(match(student_id: "N-1", by: by_manager).state).to eq "none"
    end

    it "offers nothing to someone who can't manage anyone" do
      make_student("Pat Student")
      teacher = teacher_in_course(active_all: true).user
      expect(match(name: "Pat Student", by: described_class.new(teacher, root_account)).state).to eq "none"
    end
  end

  describe "#to_h" do
    it "is the stored shape" do
      pat = make_student("Pat Student", sis: "1")
      expect(match(name: "Pat Student", student_id: "1").to_h).to eq(
        "state" => "confident",
        "candidates" => [{ "id" => pat.id.to_s, "name" => "Pat Student", "sis_user_id" => "1", "reason" => "id" }],
        "student_id_on_doc" => "1"
      )
    end
  end
end
