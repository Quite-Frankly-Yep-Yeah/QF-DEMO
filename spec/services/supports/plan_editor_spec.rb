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

describe Supports::PlanEditor do
  let_once(:root_account) { Account.default }
  let_once(:school) { root_account.sub_accounts.create!(name: "Lincoln High") }
  let_once(:course) { course_factory(account: school, active_all: true, course_name: "Algebra 1") }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:case_manager) do
    user_factory(active_all: true).tap do |user|
      school.account_users.create!(user:, role: Supports::Roles.ensure_case_manager!(root_account))
    end
  end
  let_once(:extended_time) do
    Supports::Catalog.ensure_defaults!(root_account)
    Supports::AccommodationType.find_by(root_account:, kind: "extended_time")
  end

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
    Supports::Caseload.create!(root_account:, staff: case_manager, student:)
  end

  let(:editor) { described_class.new(case_manager, student, root_account) }
  let(:plan) { editor.create_plan!(plan_type: "504", start_date: "2026-09-01", end_date: "2027-09-01") }

  describe "#create_plan!" do
    it "creates a plan in the student's school" do
      expect(plan.account).to eql school
      expect(plan.created_by).to eql case_manager
    end

    it "refuses a teacher" do
      expect { described_class.new(teacher, student, root_account).create_plan!(plan_type: "504") }
        .to raise_error(Supports::PlanEditor::Forbidden)
    end

    it "only takes a staff member as case manager" do
      expect { editor.create_plan!(plan_type: "iep", case_manager_id: teacher.id) }
        .to raise_error(ActiveRecord::RecordInvalid)
    end

    it "puts the case manager on the student's team" do
      other_manager = user_factory(active_all: true)
      school.account_users.create!(user: other_manager, role: Supports::Roles.ensure_case_manager!(root_account))
      editor.create_plan!(plan_type: "iep", case_manager_id: other_manager.id)
      expect(Supports::Caseload.assigned?(other_manager, student, root_account)).to be true
    end
  end

  describe "accommodations" do
    it "bumps the plan version when one is added, so teachers acknowledge again" do
      expect { editor.add_accommodation!(plan, accommodation_type_id: extended_time.id) }
        .to change { plan.reload.version }.by(1)
    end

    it "starts from the catalog's default parameters" do
      row = editor.add_accommodation!(plan, accommodation_type_id: extended_time.id)
      expect(row.parameters).to eql("multiplier" => 1.5)
    end

    it "only keeps courses the student is in" do
      other_course = course_factory(account: school, active_all: true)
      row = editor.add_accommodation!(plan, accommodation_type_id: extended_time.id, course_ids: [course.id, other_course.id])
      expect(row.course_ids).to eql [course.id]
    end

    it "doesn't bump the version when only re-verified" do
      row = editor.add_accommodation!(plan, accommodation_type_id: extended_time.id)
      expect { editor.update_accommodation!(row, verified: "1") }.not_to change { plan.reload.version }
    end
  end

  describe "#as_json" do
    it "is nil for a teacher, who only sees accommodations" do
      expect(described_class.new(teacher, student, root_account).as_json).to be_nil
    end

    it "shows plan details to the case manager and logs the read" do
      plan
      json = editor.as_json
      expect(json[:plans].first[:plan_type]).to eql "504"
      expect(Supports::AccessLog.where(viewer: case_manager, student:, tier: 2).count).to be 1
    end

    it "lists the student's teachers who haven't acknowledged" do
      editor.add_accommodation!(plan, accommodation_type_id: extended_time.id)
      acknowledgements = editor.as_json[:plans].first[:acknowledgements]
      expect(acknowledgements).to include({ id: teacher.id.to_s, name: teacher.name, acknowledged: false })
      expect(acknowledgements.pluck(:acknowledged)).to all(be false)
    end
  end

  it "stores plan notes encrypted" do
    plan.update!(notes: "Sensitive detail")
    raw = Supports::Plan.connection.select_value("SELECT notes FROM #{Supports::Plan.quoted_table_name} WHERE id = #{plan.id}")
    expect(raw).not_to include "Sensitive detail"
    expect(plan.reload.notes).to eql "Sensitive detail"
  end

  describe "the original IEP behind a scanned plan" do
    let(:scanned_plan) { Supports::Plan.create!(account: school, student:, plan_type: "iep", source: "scan") }

    def scan_for(plan, **attrs)
      Supports::Import.create!({ account: root_account,
                                 user: case_manager,
                                 student:,
                                 plan:,
                                 format: "iep_scan",
                                 workflow_state: "applied",
                                 applied_at: Time.zone.now,
                                 filename: "iep.pdf",
                                 content_type: "application/pdf",
                                 data: Base64.strict_encode64("%PDF-1.4 SECRET-DOC") }.merge(attrs))
    end

    def scans_of(viewer, plan)
      described_class.new(viewer, student, root_account).as_json[:plans].find { |json| json[:id] == plan.id.to_s }[:scans]
    end

    it "lists each applied scan, newest first, with its id, filename and date" do
      older = scan_for(scanned_plan, filename: "old.pdf", applied_at: Time.zone.parse("2026-09-01 12:00"))
      newer = scan_for(scanned_plan, filename: "new.pdf", applied_at: Time.zone.parse("2026-10-02 12:00"))
      expect(scans_of(case_manager, scanned_plan)).to eq [
        { id: newer.id, filename: "new.pdf", applied_at: "2026-10-02T12:00:00Z" },
        { id: older.id, filename: "old.pdf", applied_at: "2026-09-01T12:00:00Z" }
      ]
    end

    it "leaves out a scan that was undone, a preview that was discarded, and one whose file is gone" do
      scan_for(scanned_plan, workflow_state: "undone", undone_at: Time.zone.now)
      scan_for(scanned_plan, workflow_state: "discarded", data: nil)
      scan_for(scanned_plan, data: nil)
      expect(scans_of(case_manager, scanned_plan)).to eq []
    end

    it "has none for a plan that wasn't scanned, or whose import was a CSV" do
      manual = plan
      scan_for(manual, format: "generic", filename: "plans.csv")
      expect(scans_of(case_manager, manual)).to eq []
    end

    it "only tells someone who may manage the plan, and never carries the file itself" do
      scan_for(scanned_plan)
      role = custom_account_role("Plan viewer", account: root_account)
      root_account.role_overrides.create!(permission: "supports_view_plans", role:, enabled: true)
      viewer = user_factory(active_all: true)
      school.account_users.create!(user: viewer, role:)
      Supports::Caseload.create!(root_account:, staff: viewer, student:)
      json = described_class.new(viewer, student, root_account).as_json
      expect(json[:can_manage]).to be false
      expect(json[:plans].find { |p| p[:id] == scanned_plan.id.to_s }[:scans]).to eq []
      expect(editor.as_json.to_json).not_to include("SECRET-DOC")
    end
  end
end
