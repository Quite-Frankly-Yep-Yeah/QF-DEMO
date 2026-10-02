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
end
