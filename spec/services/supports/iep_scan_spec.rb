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

describe Supports::IepScan do
  let_once(:root_account) { Account.default }
  let_once(:admin) { account_admin_user(account: root_account) }
  let_once(:student) { user_factory(active_all: true, name: "Pat Student") }
  let_once(:bystander) { user_factory(active_all: true) }

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
    root_account.enable_feature!(:iep_scan)
  end

  let(:scan) { described_class.new(root_account, admin) }
  let(:pdf) { "%PDF-1.4 SECRET-DOC" }
  let(:upload) { Rack::Test::UploadedFile.new(StringIO.new(pdf), "application/pdf", original_filename: "iep.pdf") }
  let(:time_type) { Supports::Catalog.types(root_account).find_by(kind: "extended_time") }
  let(:result) do
    Supports::IepExtractor::Result.new(
      "Pat Student",
      "2010-04-02",
      "iep",
      "2026-09-01",
      "2027-06-15",
      [{ "type_id" => time_type.id,
         "kind" => "extended_time",
         "params" => { "multiplier" => 1.5 },
         "source_quote" => "time and a half",
         "page" => 3,
         "confidence" => "high",
         "errors" => [],
         "included" => true }],
      [{ "text" => "Speech therapy", "page" => 5 }]
    )
  end

  def stub_extractor(outcome)
    extractor = instance_double(Supports::IepExtractor)
    if outcome.is_a?(Exception)
      allow(extractor).to receive(:call).and_raise(outcome)
    else
      allow(extractor).to receive(:call).and_return(outcome)
    end
    allow(Supports::IepExtractor).to receive(:new).and_return(extractor)
    extractor
  end

  describe "#create!" do
    it "saves a queued scan with the document encrypted and enqueues the reading" do
      import = scan.create!(student:, file: upload)
      expect(import).to have_attributes(format: "iep_scan",
                                        student:,
                                        user: admin,
                                        extraction_state: "queued",
                                        content_type: "application/pdf",
                                        filename: "iep.pdf",
                                        workflow_state: "previewed")
      expect(Base64.strict_decode64(import.data)).to eq pdf
      expect(Delayed::Job.where("handler LIKE ?", "%extract%").count).to eq 1
    end

    it "refuses a user who can't manage that student" do
      expect { described_class.new(root_account, bystander).create!(student:, file: upload) }
        .to raise_error(Supports::Importer::Forbidden)
    end

    it "refuses when the flag is off" do
      root_account.disable_feature!(:iep_scan)
      expect { scan.create!(student:, file: upload) }.to raise_error(Supports::Importer::Forbidden)
    end

    it "lets a case manager scan for a student on their caseload, and only theirs" do
      role = custom_account_role("Case manager", account: root_account)
      root_account.role_overrides.create!(permission: "supports_manage_plans", role:, enabled: true)
      manager = user_factory(active_all: true)
      root_account.account_users.create!(user: manager, role:)
      other = user_factory(active_all: true)
      Supports::Caseload.create!(root_account:, staff_id: manager.id, student_id: student.id)

      expect(described_class.new(root_account, manager).create!(student:, file: upload)).to be_persisted
      expect { described_class.new(root_account, manager).create!(student: other, file: upload) }
        .to raise_error(Supports::Importer::Forbidden)
    end

    it "rejects a file type it can't read" do
      bad = Rack::Test::UploadedFile.new(StringIO.new("hi"), "text/plain", original_filename: "x.txt")
      expect { scan.create!(student:, file: bad) }.to raise_error(described_class::Invalid, /PDF/)
    end

    it "rejects a file over 10 MB" do
      big = Rack::Test::UploadedFile.new(StringIO.new("x" * (10.megabytes + 1)), "application/pdf", original_filename: "big.pdf")
      expect { scan.create!(student:, file: big) }.to raise_error(described_class::Invalid, /10 MB/)
    end
  end

  describe ".extract" do
    let!(:import) { scan.create!(student:, file: upload) }

    it "moves the scan to ready with the proposal and a preview" do
      stub_extractor(result)
      described_class.extract(import.id)
      import.reload
      expect(import.extraction_state).to eq "ready"
      expect(import.extraction["items"].pluck("kind")).to eq ["extended_time"]
      expect(import.extraction["unmapped"]).to eq [{ "text" => "Speech therapy", "page" => 5 }]
      expect(import.extraction["plan"]).to eq("plan_type" => "iep", "start_date" => "2026-09-01", "end_date" => "2027-06-15")
      expect(import.preview["scan"]).to include("student_name_on_doc" => "Pat Student",
                                                "dob_on_doc" => "2010-04-02",
                                                "mismatch" => false)
      expect(import.preview["rows"].first).to include("accommodation" => time_type.name,
                                                      "source_quote" => "time and a half",
                                                      "page" => 3,
                                                      "confidence" => "high")
    end

    it "marks a document for a different student" do
      stub_extractor(result.tap { |r| r.student_name = "Riley Other" })
      described_class.extract(import.id)
      expect(import.reload.preview.dig("scan", "mismatch")).to be true
    end

    it "treats the same name in another order, with a middle name, as the same student" do
      stub_extractor(result.tap { |r| r.student_name = "Student, Pat Q." })
      described_class.extract(import.id)
      expect(import.reload.preview.dig("scan", "mismatch")).to be false
    end

    it "fails with the extractor's message and keeps the file, so it can be retried" do
      stub_extractor(Supports::IepExtractor::Failed.new("The document couldn't be read."))
      described_class.extract(import.id)
      import.reload
      expect(import).to have_attributes(extraction_state: "failed", extraction_error: "The document couldn't be read.")
      expect(Base64.strict_decode64(import.data)).to eq pdf

      stub_extractor(result)
      scan.retry!(import)
      expect(import.reload).to have_attributes(extraction_state: "queued", extraction_error: nil)
      described_class.extract(import.id)
      expect(import.reload.extraction_state).to eq "ready"
    end

    it "only retries a failed scan" do
      expect { scan.retry!(import) }.to raise_error(ArgumentError)
    end

    it "does nothing for a scan that already finished" do
      stub_extractor(result)
      described_class.extract(import.id)
      expect(Supports::IepExtractor).not_to receive(:new)
      described_class.extract(import.id)
    end
  end

  describe "review and apply" do
    let(:read_aloud) { Supports::Catalog.types(root_account).find_by(name: "Read aloud") }

    def item(type, params: {}, included: true, errors: [], quote: "q")
      { "type_id" => type.id,
        "kind" => type.kind,
        "params" => params,
        "source_quote" => quote,
        "page" => 1,
        "confidence" => "high",
        "errors" => errors,
        "included" => included }
    end

    # a scan that has been read, ready for review
    def ready_scan(items: result.items, for_student: student, doc_name: "Pat Student", unmapped: result.unmapped)
      import = scan.create!(student: for_student, file: upload)
      stub_extractor(Supports::IepExtractor::Result.new(doc_name, nil, "iep", "2026-09-01", "2027-06-15", items, unmapped))
      described_class.extract(import.id)
      import.reload
    end

    describe "#update_review!" do
      it "re-checks an edited item and clears its error" do
        import = ready_scan(items: [item(time_type,
                                         params: { "multiplier" => 9 },
                                         included: false,
                                         errors: ["The time multiplier must be more than 1 and at most 5."])])
        scan.update_review!(import, items: [{ "index" => 0, "included" => true, "params" => { "multiplier" => 2 } }])
        expect(import.extraction["items"].first).to include("params" => { "multiplier" => 2 }, "errors" => [], "included" => true)
        expect(import.preview["summary"]["blocking"]).to eq 0
      end

      it "blocks an included item whose edit is still invalid" do
        import = ready_scan
        scan.update_review!(import, items: [{ "index" => 0, "params" => { "multiplier" => 9 } }])
        expect(import.preview["summary"]["blocking"]).to eq 1
        expect(import.preview["rows"].first["action"]).to eq "error"
      end

      it "blocks two included items for the same accommodation until one is dropped" do
        import = ready_scan(items: [item(time_type, params: { "multiplier" => 1.5 }),
                                    item(time_type, params: { "multiplier" => 2 })])
        expect(import.preview["summary"]["blocking"]).to eq 1
        expect(import.extraction["items"].last["errors"].join).to match(/already/)
        scan.update_review!(import, items: [{ "index" => 1, "included" => false }])
        expect(import.preview["summary"]["blocking"]).to eq 0
      end

      it "blocks a plan type that isn't one of ours, and takes a fixed one" do
        import = ready_scan
        scan.update_review!(import, plan: { "plan_type" => "mystery" })
        expect(import.preview["summary"]["blocking"]).to eq 1
        scan.update_review!(import, plan: { "plan_type" => "504" })
        expect(import.preview["summary"]["blocking"]).to eq 0
        expect(import.extraction["plan"]["plan_type"]).to eq "504"
      end

      it "rejects an item or note that doesn't exist" do
        import = ready_scan
        expect { scan.update_review!(import, items: [{ "index" => 5, "included" => false }]) }.to raise_error(described_class::Invalid)
        expect { scan.update_review!(import, keep_unmapped: [3]) }.to raise_error(described_class::Invalid)
      end

      it "only edits a scan that is ready and that the user may manage" do
        import = ready_scan
        expect { described_class.new(root_account, bystander).update_review!(import, items: []) }
          .to raise_error(Supports::Importer::Forbidden)
        import.update!(extraction_state: "failed")
        expect { scan.update_review!(import, items: []) }.to raise_error(ArgumentError)
      end
    end

    describe "#apply! and #undo!" do
      it "creates the plan and its accommodations, with what was kept from the unmapped list" do
        import = ready_scan(items: [item(time_type, params: { "multiplier" => 1.5 }), item(read_aloud)])
        scan.update_review!(import, keep_unmapped: [0])
        scan.apply!(import)

        plan = Supports::Plan.find(import.reload.plan_id)
        expect(import.workflow_state).to eq "applied"
        expect(plan).to have_attributes(student:,
                                        plan_type: "iep",
                                        source: "scan",
                                        start_date: Date.new(2026, 9, 1),
                                        end_date: Date.new(2027, 6, 15),
                                        version: 2)
        expect(plan.accommodations.active.map { |a| a.accommodation_type.name }).to match_array [time_type.name, "Read aloud"]
        expect(plan.accommodations.find_by(accommodation_type: time_type).parameters).to eq("multiplier" => 1.5)
        expect(plan.notes).to include("Speech therapy")
      end

      it "leaves out an item the reviewer dropped, and a note they didn't keep" do
        import = ready_scan(items: [item(time_type, params: { "multiplier" => 1.5 }), item(read_aloud)])
        scan.update_review!(import, items: [{ "index" => 1, "included" => false }])
        scan.apply!(import)
        plan = Supports::Plan.find(import.reload.plan_id)
        expect(plan.accommodations.active.count).to eq 1
        expect(plan.notes.to_s).not_to include("Speech therapy")
      end

      it "won't apply a document for another student until the reviewer says so" do
        import = ready_scan(doc_name: "Riley Other")
        expect { scan.apply!(import) }.to raise_error(ArgumentError, /different student/)
        scan.update_review!(import, acknowledged_mismatch: true)
        expect { scan.apply!(import) }.not_to raise_error
      end

      it "won't apply while something is blocking" do
        import = ready_scan
        scan.update_review!(import, items: [{ "index" => 0, "params" => { "multiplier" => 9 } }])
        expect { scan.apply!(import) }.to raise_error(ArgumentError, /fix/i)
        expect(Supports::Plan.where(student:).count).to eq 0
      end

      it "won't apply twice" do
        import = ready_scan
        scan.apply!(import)
        expect { scan.apply!(import) }.to raise_error(ArgumentError, /applied/)
      end

      it "puts back what an existing plan had when undone, and removes what it made" do
        old = Supports::Plan.create!(account: root_account, student:, plan_type: "iep", start_date: Date.new(2025, 9, 1))
        old.accommodations.create!(accommodation_type: time_type, parameters: { "multiplier" => 1.25 })
        import = ready_scan
        scan.apply!(import)
        expect(old.accommodations.active.first.reload.parameters).to eq("multiplier" => 1.5)
        expect(old.reload.start_date).to eq Date.new(2026, 9, 1)

        scan.undo!(import)
        expect(old.accommodations.active.first.reload.parameters).to eq("multiplier" => 1.25)
        expect(old.reload.start_date).to eq Date.new(2025, 9, 1)
        expect(import.reload.workflow_state).to eq "undone"
      end

      it "shows a second scan of the same plan as no change, and a different value as a change" do
        scan.apply!(ready_scan)
        same = ready_scan
        expect(same.preview["rows"].first["action"]).to eq "unchanged"
        different = ready_scan(items: [item(time_type, params: { "multiplier" => 2 })])
        expect(different.preview["rows"].first["action"]).to eq "update"
      end

      it "refuses someone who can't manage the student" do
        import = ready_scan
        expect { described_class.new(root_account, bystander).apply!(import) }.to raise_error(Supports::Importer::Forbidden)
      end
    end
  end
end
