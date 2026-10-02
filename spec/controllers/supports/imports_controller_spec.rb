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

describe Supports::ImportsController do
  let_once(:root_account) { Account.default }
  let_once(:admin) { account_admin_user(account: root_account) }
  let_once(:student) do
    user_factory(active_all: true, name: "Pat Student").tap { |u| u.pseudonyms.create!(unique_id: "pat@example.com", account: root_account) }
  end
  let_once(:bystander) do
    user_factory(active_all: true).tap { |u| u.pseudonyms.create!(unique_id: "by@example.com", account: root_account) }
  end

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
    root_account.enable_feature!(:iep_scan)
  end

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

  def json
    json_parse(response.body)
  end

  # a scan that has been read, as the admin uploaded it
  def ready_scan
    import = Supports::IepScan.new(root_account, admin).create!(student:, file: upload)
    extractor = instance_double(Supports::IepExtractor, call: result)
    allow(Supports::IepExtractor).to receive(:new).and_return(extractor)
    Supports::IepScan.extract(import.id)
    import.reload
  end

  describe "POST 'create' for an IEP scan" do
    before { user_session(admin) }

    it "saves a queued scan for the student without sending the document back" do
      post :create, params: { student_id: student.id, file: upload }
      expect(response).to be_successful
      expect(json).to include("format" => "iep_scan", "extraction_state" => "queued", "filename" => "iep.pdf")
      expect(json["student"]).to eq("id" => student.id.to_s, "name" => "Pat Student")
      expect(response.body).not_to include("SECRET-DOC")
      expect(response.body).not_to include(Base64.strict_encode64(pdf))
    end

    it "asks for a file" do
      post :create, params: { student_id: student.id }
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "refuses a file type it can't read and one that is too large" do
      post :create, params: { student_id: student.id,
                              file: Rack::Test::UploadedFile.new(StringIO.new("hi"), "text/plain", original_filename: "x.txt") }
      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"].first).to match(/PDF/)

      big = Rack::Test::UploadedFile.new(StringIO.new("x" * (20.megabytes + 1)), "application/pdf", original_filename: "b.pdf")
      post :create, params: { student_id: student.id, file: big }
      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"].first).to match(/20 MB/)
    end

    it "is refused while the scan flag is off" do
      root_account.disable_feature!(:iep_scan)
      post :create, params: { student_id: student.id, file: upload }
      expect(response).to have_http_status(:forbidden)
    end

    it "404s for a student that doesn't exist" do
      post :create, params: { student_id: 0, file: upload }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "permissions" do
    it "refuses someone who can't manage the student" do
      user_session(bystander)
      post :create, params: { student_id: student.id, file: upload }
      expect(response).to have_http_status(:forbidden)
    end

    it "lets a case manager scan their own student and nobody else's" do
      role = custom_account_role("Case manager", account: root_account)
      root_account.role_overrides.create!(permission: "supports_manage_plans", role:, enabled: true)
      manager = user_factory(active_all: true)
      root_account.account_users.create!(user: manager, role:)
      Supports::Caseload.create!(root_account:, staff_id: manager.id, student_id: student.id)
      user_session(manager)

      post :create, params: { student_id: student.id, file: upload }
      expect(response).to be_successful
      post :create, params: { student_id: bystander.id, file: upload }
      expect(response).to have_http_status(:forbidden)
    end

    it "keeps the CSV import for people who manage every student" do
      user_session(bystander)
      post :create, params: { file: Rack::Test::UploadedFile.new(StringIO.new("student_sis_id\n"), "text/csv", original_filename: "a.csv") }
      expect(response).to have_http_status(:unauthorized)
    end

    it "doesn't let anyone list imports by adding a student_id to the request" do
      ready_scan
      user_session(bystander)
      get :index, params: { student_id: student.id }
      expect(response).to have_http_status(:unauthorized)
      expect(response.body).not_to include("Pat Student")
    end

    it "hides a scan from someone who can't manage its student" do
      import = ready_scan
      user_session(bystander)
      get :show, params: { id: import.id }
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET 'show'" do
    before { user_session(admin) }

    it "reports a scan's progress and what was read" do
      import = ready_scan
      get :show, params: { id: import.id }
      expect(response).to be_successful
      expect(json).to include("extraction_state" => "ready", "workflow_state" => "previewed")
      expect(json["rows"].first).to include("accommodation" => time_type.name, "source_quote" => "time and a half", "page" => 3)
      expect(json["scan"]).to include("mismatch" => false, "plan_type" => "iep")
      expect(response.body).not_to include("SECRET-DOC")
    end
  end

  describe "PUT 'review'" do
    before { user_session(admin) }

    it "takes the reviewer's edits" do
      import = ready_scan
      put :review,
          params: { id: import.id,
                    items: [{ index: 0, included: true, params: { multiplier: 2 } }],
                    plan: { plan_type: "504" },
                    keep_unmapped: [0],
                    acknowledged_mismatch: false },
          as: :json
      expect(response).to be_successful
      expect(import.reload.extraction["items"].first["params"]).to eq("multiplier" => 2)
      expect(import.extraction["plan"]["plan_type"]).to eq "504"
      expect(import.extraction["keep_unmapped"]).to eq [0]
    end

    it "returns a bad value flagged rather than refusing it" do
      import = ready_scan
      put :review, params: { id: import.id, items: [{ index: 0, params: { multiplier: 9 } }] }, as: :json
      expect(response).to be_successful
      expect(json["summary"]["blocking"]).to eq 1
      expect(json["rows"].first["errors"]).not_to be_empty
    end

    it "refuses an item that isn't there" do
      import = ready_scan
      put :review, params: { id: import.id, items: [{ index: 9, included: false }] }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "apply, undo, discard" do
    before { user_session(admin) }

    it "applies a reviewed scan, then undoes it" do
      import = ready_scan
      post :apply, params: { id: import.id }
      expect(response).to be_successful
      expect(json["workflow_state"]).to eq "applied"
      expect(Supports::Plan.where(student:, source: "scan").count).to eq 1

      post :undo, params: { id: import.id }
      expect(response).to be_successful
      expect(json["workflow_state"]).to eq "undone"
    end

    it "won't apply while something is blocking" do
      import = ready_scan
      put :review, params: { id: import.id, items: [{ index: 0, params: { multiplier: 9 } }] }, as: :json
      post :apply, params: { id: import.id }
      expect(response).to have_http_status(:unprocessable_content)
      expect(Supports::Plan.where(student:).count).to eq 0
    end

    it "answers a second apply with a conflict" do
      import = ready_scan
      post :apply, params: { id: import.id }
      post :apply, params: { id: import.id }
      expect(response).to have_http_status(:conflict)
    end

    it "discards a preview and drops the document and what was read" do
      import = ready_scan
      delete :destroy, params: { id: import.id }
      expect(response).to be_successful
      import.reload
      expect([import.workflow_state, import.data, import.extraction]).to eq ["discarded", nil, nil]
    end
  end

  describe "POST 'retry'" do
    before { user_session(admin) }

    it "puts a failed scan back in the queue, and refuses one that isn't failed" do
      import = ready_scan
      post :retry, params: { id: import.id }
      expect(response).to have_http_status(:conflict)

      import.update!(extraction_state: "failed", extraction_error: "The document couldn't be read.")
      post :retry, params: { id: import.id }
      expect(response).to be_successful
      expect(json["extraction_state"]).to eq "queued"
    end
  end

  describe "GET 'document'" do
    it "gives the original to someone who can manage the plan, and logs it" do
      import = ready_scan
      user_session(admin)
      expect { get :document, params: { id: import.id } }.to change { Supports::AccessLog.where(student:).count }.by(1)
      expect(response).to be_successful
      expect(response.body).to eq pdf
      expect(response.media_type).to eq "application/pdf"
      expect(Supports::AccessLog.where(student:).last).to have_attributes(viewer: admin, tier: Supports::TIERS[:documents])
    end

    it "refuses someone who can't, without logging" do
      import = ready_scan
      user_session(bystander)
      expect { get :document, params: { id: import.id } }.not_to change { Supports::AccessLog.count }
      expect(response).to have_http_status(:forbidden)
    end

    it "has nothing to give once the preview was discarded" do
      import = ready_scan
      import.update!(workflow_state: "discarded", data: nil, extraction: nil)
      user_session(admin)
      get :document, params: { id: import.id }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "scans in a batch" do
    let(:other_admin) { account_admin_user(account: root_account) }

    def batch_scan(by: admin)
      Supports::IepScan.new(root_account, by).create_batch!(files: [upload]).imports.first
    end

    def read(import)
      extractor = instance_double(Supports::IepExtractor, call: result)
      allow(Supports::IepExtractor).to receive(:new).and_return(extractor)
      Supports::IepScan.extract(import.id)
      import.reload
    end

    describe "PUT 'student'" do
      before { user_session(admin) }

      it "confirms the student and returns the scan with a preview against them" do
        import = read(batch_scan)
        put :student, params: { id: import.id, student_id: student.id }
        expect(response).to be_successful
        expect(json["student"]).to eq("id" => student.id.to_s, "name" => "Pat Student")
        expect(json["rows"].first).to include("student" => "Pat Student")
        expect(import.reload.student).to eq student
      end

      it "refuses a student the user may not manage, and attaches nothing" do
        role = custom_account_role("Case manager", account: root_account)
        root_account.role_overrides.create!(permission: "supports_manage_plans", role:, enabled: true)
        manager = user_factory(active_all: true)
        root_account.account_users.create!(user: manager, role:)
        Supports::Caseload.create!(root_account:, staff_id: manager.id, student_id: student.id)
        import = batch_scan(by: manager)
        user_session(manager)

        put :student, params: { id: import.id, student_id: bystander.id }
        expect(response).to have_http_status(:forbidden)
        put :student, params: { id: import.id, student_id: manager.id }
        expect(response).to have_http_status(:forbidden)
        put :student, params: { id: import.id, student_id: 0 }
        expect(response).to have_http_status(:forbidden)
        put :student, params: { id: import.id, student_id: "1 OR 1=1" }
        expect(response).to have_http_status(:forbidden)
        expect(import.reload.student).to be_nil

        put :student, params: { id: import.id, student_id: student.id }
        expect(response).to be_successful
      end

      it "refuses a student at another school" do
        other_root = Account.create!(name: "Elsewhere")
        olive = user_factory(active_all: true, name: "Olive").tap { |u| u.pseudonyms.create!(unique_id: "o@example.com", account: other_root) }
        import = batch_scan
        put :student, params: { id: import.id, student_id: olive.id }
        expect(response).to have_http_status(:forbidden)
        expect(import.reload.student).to be_nil
      end

      it "answers a conflict after the scan was applied" do
        import = read(batch_scan)
        put :student, params: { id: import.id, student_id: student.id }
        post :apply, params: { id: import.id }
        expect(response).to be_successful
        put :student, params: { id: import.id, student_id: bystander.id }
        expect(response).to have_http_status(:conflict)
        expect(import.reload.student).to eq student
      end

      it "is refused to anyone but the uploader of an unmatched scan, an admin included" do
        import = batch_scan
        user_session(other_admin)
        put :student, params: { id: import.id, student_id: student.id }
        expect(response).to have_http_status(:forbidden)
        expect(import.reload.student).to be_nil
      end

      it "404s for a CSV import" do
        csv = Supports::Import.create!(account: root_account, user: admin)
        put :student, params: { id: csv.id, student_id: student.id }
        expect(response).to have_http_status(:not_found)
      end
    end

    describe "before the student is confirmed" do
      before { user_session(admin) }

      it "answers review and apply with a conflict that says to confirm the student" do
        import = read(batch_scan)
        put :review, params: { id: import.id, items: [{ index: 0, included: false }] }
        expect(response).to have_http_status(:conflict)
        expect(json["errors"]).to eq ["Confirm the student first."]
        post :apply, params: { id: import.id }
        expect(response).to have_http_status(:conflict)
        expect(json["errors"]).to eq ["Confirm the student first."]
        expect(import.reload.workflow_state).to eq "previewed"
      end

      it "works after confirming" do
        import = read(batch_scan)
        put :student, params: { id: import.id, student_id: student.id }
        put :review, params: { id: import.id, items: [{ index: 0, included: false }] }
        expect(response).to be_successful
        post :apply, params: { id: import.id }
        expect(response).to be_successful
        expect(json["workflow_state"]).to eq "applied"
      end

      it "lets the uploader try again a scan that couldn't be read" do
        import = batch_scan
        import.update!(extraction_state: "failed", extraction_error: "no")
        post :retry, params: { id: import.id }
        expect(response).to be_successful
        expect(json["extraction_state"]).to eq "queued"
      end

      it "lets the uploader download their unmatched file" do
        import = batch_scan
        get :document, params: { id: import.id }
        expect(response).to be_successful
        expect(response.body).to eq pdf
      end

      it "skips an unmatched scan, deleting its file and what was read" do
        import = read(batch_scan)
        delete :destroy, params: { id: import.id }
        expect(response).to be_successful
        import.reload
        expect([import.workflow_state, import.data, import.extraction]).to eq ["discarded", nil, nil]
      end
    end

    describe "an unmatched scan belongs to its uploader alone" do
      let!(:import) { read(batch_scan) }

      before { user_session(other_admin) }

      it "can't be shown, reviewed, retried, downloaded, skipped or applied by another admin" do
        get :show, params: { id: import.id }
        expect(response).to have_http_status(:forbidden)
        put :review, params: { id: import.id, items: [] }
        expect(response).to have_http_status(:forbidden)
        import.update!(extraction_state: "failed")
        post :retry, params: { id: import.id }
        expect(response).to have_http_status(:forbidden)
        get :document, params: { id: import.id }
        expect(response).to have_http_status(:forbidden)
        delete :destroy, params: { id: import.id }
        expect(response).to have_http_status(:forbidden)
        post :apply, params: { id: import.id }
        expect(response).to have_http_status(:forbidden)
        expect(import.reload).to have_attributes(workflow_state: "previewed", student: nil)
        expect(import.data).to be_present
      end

      it "isn't in another admin's list of imports, and is in the uploader's" do
        get :index
        expect(json["imports"].pluck("id")).not_to include(import.id)
        expect(response.body).not_to include("Pat Student")
        user_session(admin)
        get :index
        expect(json["imports"].pluck("id")).to include(import.id)
      end

      it "can't be reached by someone who can manage students but didn't upload it" do
        user_session(bystander)
        get :show, params: { id: import.id }
        expect(response).to have_http_status(:forbidden)
      end
    end

    it "doesn't show the match to someone else who manages the confirmed student" do
      import = read(batch_scan)
      user_session(admin)
      put :student, params: { id: import.id, student_id: student.id }
      expect(json["match"]).to include("state" => "confident")
      user_session(other_admin)
      get :show, params: { id: import.id }
      expect(response).to be_successful
      expect(json["match"]).to be_nil
      expect(json["student"]).to include("name" => "Pat Student")
    end

    it "leaves the single-scan upload unchanged" do
      user_session(admin)
      post :create, params: { student_id: student.id, file: upload }
      expect(response).to be_successful
      expect(json).to include("extraction_state" => "queued", "batch_id" => nil, "match" => nil)
      expect(json["student"]).to eq("id" => student.id.to_s, "name" => "Pat Student")
    end
  end
end
