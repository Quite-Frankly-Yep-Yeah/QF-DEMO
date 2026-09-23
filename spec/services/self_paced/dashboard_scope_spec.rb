# frozen_string_literal: true

#
# Copyright (C) 2026 - present EXAMPLE contributors
#
# This file is part of EXAMPLE LMS, a modified version of Canvas.
#
# EXAMPLE LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

describe SelfPaced::DashboardScope do
  let_once(:root_account) { Account.create! }
  let_once(:school) { root_account.sub_accounts.create!(name: "North High") }
  let_once(:other_school) { root_account.sub_accounts.create!(name: "South High") }
  let_once(:course) { course_factory(account: school, active_all: true) }
  let_once(:other_course) { course_factory(account: other_school, active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:mentor) { user_factory(active_all: true) }

  def enable_dashboard
    root_account.enable_feature!(:self_paced)
    root_account.enable_feature!(:self_paced_activity_tracking)
    root_account.enable_feature!(:self_paced_teacher_dashboard)
  end

  def track(course, student)
    SelfPaced::StudentCourseState.create!(course:, user: student, root_account:)
  end

  describe "#courses" do
    it "is empty while the dashboard is off" do
      expect(described_class.new(teacher).courses).to be_empty
    end

    context "with the dashboard on" do
      before { enable_dashboard }

      it "gives teachers the courses they teach" do
        expect(described_class.new(teacher).courses).to eql([course])
      end

      it "gives students nothing" do
        expect(described_class.new(student).courses).to be_empty
      end

      it "gives a school mentor every tracked course in their school, and only their school" do
        track(course, student)
        track(other_course, student_in_course(course: other_course, active_all: true).user)
        school.account_users.create!(user: mentor, role: SelfPaced::MentorRole.ensure!(root_account))

        expect(described_class.new(mentor).courses).to eql([course])
      end
    end

    it "leaves out courses in schools that haven't turned the dashboard on" do
      root_account.enable_feature!(:self_paced)
      root_account.enable_feature!(:self_paced_activity_tracking)
      other_school.enable_feature!(:self_paced_teacher_dashboard)

      expect(described_class.new(teacher).courses).to be_empty
    end
  end

  describe "grade visibility" do
    before { enable_dashboard }

    it "shows teachers unposted grades" do
      scope = described_class.new(teacher)

      expect([scope.grades_visible?(course), scope.unposted_grades_visible?(course)]).to eql([true, true])
    end

    it "shows mentors posted grades only" do
      track(course, student)
      school.account_users.create!(user: mentor, role: SelfPaced::MentorRole.ensure!(root_account))
      scope = described_class.new(mentor)

      expect([scope.grades_visible?(course), scope.unposted_grades_visible?(course)]).to eql([true, false])
    end
  end
end
