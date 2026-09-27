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

describe Supports::Access do
  let_once(:root_account) { Account.default }
  let_once(:school) { root_account.sub_accounts.create!(name: "Lincoln High") }
  let_once(:other_school) { root_account.sub_accounts.create!(name: "Other High") }
  let_once(:course) { course_factory(account: school, active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Pat Student").user }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:ta) { ta_in_course(course:, active_all: true).user }
  let_once(:observer) { observer_in_course(course:, active_all: true, associated_user_id: student.id).user }
  let_once(:other_teacher) { teacher_in_course(course: course_factory(account: school, active_all: true), active_all: true).user }
  let_once(:case_manager) { account_member(school, Supports::Roles.ensure_case_manager!(root_account)) }
  let_once(:support_staff) { account_member(school, Supports::Roles.ensure_support_staff!(root_account)) }
  let_once(:mentor) { account_member(school, SelfPaced::MentorRole.ensure!(root_account)) }
  let_once(:school_admin) { account_admin_user(account: school) }
  let_once(:other_admin) { account_admin_user(account: other_school) }

  before :once do
    root_account.enable_feature!(:student_supports)
  end

  def account_member(account, role)
    user_factory(active_all: true).tap { |user| account.account_users.create!(user:, role:) }
  end

  def assign(staff)
    Supports::Caseload.create!(root_account:, staff:, student:)
  end

  def tiers_for(viewer)
    described_class.new(viewer, student, root_account).tiers
  end

  describe "#tiers" do
    it "gives the student's teachers and TAs accommodations only" do
      expect(tiers_for(teacher)).to eql [1]
      expect(tiers_for(ta)).to eql [1]
    end

    it "gives a teacher who doesn't teach the student nothing" do
      expect(tiers_for(other_teacher)).to eql []
    end

    it "gives an assigned case manager every tier" do
      assign(case_manager)
      expect(tiers_for(case_manager)).to eql [1, 2, 3]
    end

    it "gives a case manager nothing for a student not assigned to them" do
      expect(tiers_for(case_manager)).to eql []
    end

    it "gives assigned support staff accommodations and plan details" do
      assign(support_staff)
      expect(tiers_for(support_staff)).to eql [1, 2]
    end

    it "gives an assigned mentor accommodations only" do
      assign(mentor)
      expect(tiers_for(mentor)).to eql [1]
    end

    it "does not count the mentor's own pin list as an assignment" do
      SelfPaced::MentorCaseload.create!(mentor:, student:, root_account:)
      expect(tiers_for(mentor)).to eql []
    end

    it "gives a school admin every tier for the school's students" do
      expect(tiers_for(school_admin)).to eql [1, 2, 3]
    end

    it "gives an admin of another school nothing" do
      expect(tiers_for(other_admin)).to eql []
    end

    it "gives the student and their parent nothing" do
      expect(tiers_for(student)).to eql []
      expect(tiers_for(observer)).to eql []
    end

    it "gives nobody anything while the flag is off" do
      root_account.disable_feature!(:student_supports)
      expect(tiers_for(school_admin)).to eql []
      expect(tiers_for(teacher)).to eql []
    end
  end

  describe "#view!" do
    subject(:access) { described_class.new(teacher, student, root_account) }

    it "logs an allowed read" do
      expect(access.view!(:accommodations, subject: :accommodations)).to be true
      expect(Supports::AccessLog.where(viewer: teacher, student:, tier: 1, subject: "accommodations").count).to be 1
    end

    it "logs repeat reads inside the same hour once" do
      Timecop.freeze(Time.zone.parse("2026-09-27 10:05")) { access.view!(:accommodations, subject: :accommodations) }
      Timecop.freeze(Time.zone.parse("2026-09-27 10:55")) { access.view!(:accommodations, subject: :accommodations) }
      Timecop.freeze(Time.zone.parse("2026-09-27 11:01")) { access.view!(:accommodations, subject: :accommodations) }
      expect(Supports::AccessLog.where(viewer: teacher, student:).count).to be 2
    end

    it "refuses and doesn't log a read the viewer isn't allowed" do
      expect(access.view!(:plan_details, subject: :plan)).to be false
      expect(Supports::AccessLog.where(student:).count).to be 0
    end

    it "records the real user when masquerading" do
      access.view!(:accommodations, subject: :accommodations, real_user: school_admin)
      expect(Supports::AccessLog.last.real_user).to eql school_admin
    end

    it "rejects an unknown tier" do
      expect { access.view!(:diagnosis, subject: :x) }.to raise_error(KeyError)
    end
  end
end
