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

describe Supports::Importer do
  let_once(:root_account) { Account.default }
  let_once(:school) { root_account.sub_accounts.create!(name: "Lincoln High") }
  let_once(:course) { course_factory(account: school, active_all: true).tap { |c| c.update!(sis_source_id: "MATH-1") } }
  let_once(:student) do
    student_in_course(course:, active_all: true, name: "Pat Student").user.tap do |user|
      user.pseudonyms.create!(unique_id: "pat@example.com", account: root_account, sis_user_id: "S100")
    end
  end
  let_once(:admin) { account_admin_user(account: school) }

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
  end

  let(:importer) { described_class.new(school, admin) }
  let(:csv) do
    <<~CSV
      student_sis_id,plan_type,plan_id,start_date,end_date,accommodation,parameters,courses,teacher_note
      S100,504,D-1,2026-09-01,2027-09-01,Extended time on tests and quizzes,1.5x,,Quiet room if possible
      S100,504,D-1,2026-09-01,2027-09-01,Calculator,,MATH-1,
    CSV
  end

  it "is only for people who manage every student's plans" do
    teacher = teacher_in_course(course:, active_all: true).user
    expect { described_class.new(school, teacher) }.to raise_error(Supports::Importer::Forbidden)
  end

  describe "#preview!" do
    it "shows what each row would do without changing anything" do
      import = importer.preview!(csv, filename: "plans.csv")
      expect(import.preview["rows"].pluck("action")).to eql %w[create_plan add]
      expect(Supports::Plan.count).to be 0
    end

    it "reports rows it can't use" do
      bad = csv + "S999,504,,,,Calculator,,,\nS100,504,D-1,,,Levitation,,,\n"
      rows = importer.preview!(bad).preview["rows"]
      expect(rows.pluck("action").last(2)).to eql %w[error error]
    end
  end

  describe "#apply!" do
    it "creates the plan and its accommodations" do
      importer.apply!(importer.preview!(csv))
      plan = Supports::Plan.find_by(external_id: "D-1")
      expect(plan.source).to eql "import"
      expect(plan.accommodations.active.map { |row| row.accommodation_type.name })
        .to contain_exactly("Extended time on tests and quizzes", "Calculator")
      expect(plan.accommodations.find_by(course_ids: [course.id])).to be_present
    end

    it "changes nothing when the same file comes again" do
      importer.apply!(importer.preview!(csv))
      import = importer.preview!(csv)
      expect(import.preview["rows"].pluck("action")).to eql %w[unchanged unchanged]
    end

    it "updates an accommodation whose parameters changed" do
      importer.apply!(importer.preview!(csv))
      import = importer.preview!(csv.sub("1.5x", "2x"))
      expect(import.preview["rows"].first["action"]).to eql "update"
      importer.apply!(import)
      row = Supports::StudentAccommodation.active.joins(:accommodation_type)
                                          .find_by(accommodation_types: { kind: "extended_time" })
      expect(row.parameters).to eql("multiplier" => 2.0)
    end
  end

  describe "#undo!" do
    it "removes what the import created" do
      import = importer.apply!(importer.preview!(csv))
      importer.undo!(import)
      expect(Supports::Plan.find_by(external_id: "D-1").workflow_state).to eql "deleted"
      expect(Supports::StudentAccommodation.active.count).to be 0
    end

    it "puts back what the import changed" do
      importer.apply!(importer.preview!(csv))
      second = importer.apply!(importer.preview!(csv.sub("1.5x", "2x")))
      importer.undo!(second)
      row = Supports::StudentAccommodation.active.joins(:accommodation_type)
                                          .find_by(accommodation_types: { kind: "extended_time" })
      expect(row.parameters).to eql("multiplier" => 1.5)
    end
  end

  it "keeps the uploaded file encrypted" do
    import = importer.preview!(csv)
    raw = Supports::Import.connection.select_value("SELECT data FROM #{Supports::Import.quoted_table_name} WHERE id = #{import.id}")
    expect(raw).not_to include "Quiet room"
  end
end
