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

describe Supports::CaseloadView do
  let_once(:root_account) { Account.default }
  let_once(:school) { root_account.sub_accounts.create!(name: "Lincoln High") }
  let_once(:course) { course_factory(account: school, active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Pat Student").user }
  let_once(:other_student) { student_in_course(course:, active_all: true, name: "Sam Other").user }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:case_manager) do
    user_factory(active_all: true).tap do |user|
      school.account_users.create!(user:, role: Supports::Roles.ensure_case_manager!(root_account))
    end
  end
  let_once(:admin) { account_admin_user(account: school) }

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
    Supports::Catalog.ensure_defaults!(root_account)
    [student, other_student].each do |kid|
      plan = Supports::Plan.create!(account: school, student: kid, plan_type: "504", end_date: 1.week.from_now.to_date)
      plan.accommodations.create!(accommodation_type: Supports::AccommodationType.find_by(kind: "extended_time"),
                                  parameters: { minutes: 30 })
    end
    Supports::Caseload.create!(root_account:, staff: case_manager, student:)
  end

  it "shows a case manager only their assigned students" do
    rows = described_class.new(case_manager, root_account).rows
    expect(rows.map { |row| row[:student][:name] }).to eql ["Pat Student"]
    expect(rows.first[:accommodations]).to be 1
    expect(rows.first[:unacknowledged]).to eql course.teacher_enrollments.active.count
  end

  it "shows an admin every student with a plan when asked for all" do
    rows = described_class.new(admin, root_account, scope: "all").rows
    expect(rows.map { |row| row[:student][:name] }).to contain_exactly("Pat Student", "Sam Other")
  end

  it "logs each student shown" do
    described_class.new(case_manager, root_account).rows
    expect(Supports::AccessLog.where(viewer: case_manager, subject: "caseload").count).to be 1
  end

  it "isn't available to a teacher" do
    expect(described_class.new(teacher, root_account)).not_to be_allowed
  end
end
