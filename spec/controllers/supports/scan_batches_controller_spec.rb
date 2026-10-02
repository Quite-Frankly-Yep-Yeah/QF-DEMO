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

describe Supports::ScanBatchesController do
  let_once(:root_account) { Account.default }
  let_once(:admin) { account_admin_user(account: root_account) }
  let_once(:student) do
    user_factory(active_all: true, name: "Pat Student").tap { |u| u.pseudonyms.create!(unique_id: "pat@example.com", account: root_account, sis_user_id: "S-1") }
  end

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
    root_account.enable_feature!(:iep_scan)
  end

  let(:pdf) { "%PDF-1.4 SECRET-DOC" }

  def upload(name = "iep.pdf", type: "application/pdf", body: pdf)
    Rack::Test::UploadedFile.new(StringIO.new(body), type, original_filename: name)
  end

  def json
    json_parse(response.body)
  end

  def stub_read(name: "Pat Student", student_id: nil)
    extractor = instance_double(Supports::IepExtractor, call: Supports::IepExtractor::Result.new(name, nil, "iep", "2026-09-01", "2027-06-15", [], [], student_id))
    allow(Supports::IepExtractor).to receive(:new).and_return(extractor)
  end

  def batch_for(user, count = 2)
    Supports::IepScan.new(root_account, user).create_batch!(files: Array.new(count) { |i| upload("f#{i}.pdf") })
  end

  describe "POST 'create'" do
    before { user_session(admin) }

    it "creates the batch and a queued scan per file, and returns them with the counts" do
      post :create, params: { files: [upload("a.pdf"), upload("b.pdf")] }
      expect(response).to be_successful
      expect(json["id"]).to eq Supports::ScanBatch.last.id
      expect(json["files"].pluck("filename")).to match_array %w[a.pdf b.pdf]
      expect(json["files"]).to all(include("extraction_state" => "queued", "student" => nil, "batch_id" => json["id"], "match" => nil))
      expect(json["counts"]).to eq("reading" => 2, "ready" => 0, "failed" => 0, "confirmed" => 0, "applied" => 0, "skipped" => 0)
      expect(response.body).not_to include("SECRET-DOC")
      expect(response.body).not_to include(Base64.strict_encode64(pdf))
    end

    it "takes an account_id" do
      post :create, params: { account_id: root_account.id, files: [upload] }
      expect(response).to be_successful
    end

    def expect_refused_whole(files)
      post :create, params: { files: }
      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]).to be_present
      expect(Supports::ScanBatch.count).to eq 0
      expect(Supports::Import.where(format: "iep_scan").count).to eq 0
    end

    it "refuses 26 files" do
      expect_refused_whole(Array.new(26) { upload })
    end

    it "refuses one file over 20 MB, and a text file" do
      expect_refused_whole([upload, upload("big.pdf", body: "x" * (20.megabytes + 1))])
      expect_refused_whole([upload, upload("a.txt", type: "text/plain", body: "hi")])
    end

    it "refuses more than 200 MB in all" do
      stub_const("Supports::IepScan::MAX_BATCH_BYTES", 1.kilobyte) # the real total is the same rule, smaller to test
      expect_refused_whole([upload("a.pdf", body: "x" * 600), upload("b.pdf", body: "x" * 600)])
      expect(json["errors"].first).to match(/200 MB/)
    end

    it "refuses no files, and a files param that isn't uploads" do
      expect_refused_whole([])
      expect_refused_whole(["not a file"])
      post :create
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "is refused while the scan flag is off" do
      root_account.disable_feature!(:iep_scan)
      post :create, params: { files: [upload] }
      expect(response).to have_http_status(:forbidden)
      expect(Supports::ScanBatch.count).to eq 0
    end

    it "is refused to someone who can't manage any student" do
      user_session(user_factory(active_all: true))
      post :create, params: { files: [upload] }
      expect(response).to have_http_status(:forbidden)
    end

    it "is refused for an account outside the school" do
      post :create, params: { account_id: Account.create!(name: "Elsewhere").id, files: [upload] }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET 'show'" do
    it "returns the batch with the match of each file that was read" do
      batch = batch_for(admin, 1)
      stub_read(student_id: "S-1")
      Supports::IepScan.extract(batch.imports.first.id)
      user_session(admin)
      get :show, params: { id: batch.id }
      expect(response).to be_successful
      expect(json["files"].first["match"]).to include("state" => "confident", "student_id_on_doc" => "S-1")
      expect(json["files"].first["match"]["candidates"].first).to eq("id" => student.id.to_s, "name" => "Pat Student", "sis_user_id" => "S-1", "reason" => "id")
      expect(json["counts"]).to include("ready" => 1, "reading" => 0)
    end

    it "is the uploader's alone: anyone else, an admin included, gets 404" do
      batch = batch_for(admin)
      user_session(account_admin_user(account: root_account))
      get :show, params: { id: batch.id }
      expect(response).to have_http_status(:not_found)
      [student, user_factory(active_all: true)].each do |other| # people who manage nothing are refused outright
        user_session(other)
        get :show, params: { id: batch.id }
        expect(response).to have_http_status(:forbidden)
      end
    end

    it "404s for a batch that doesn't exist, and is refused while the flag is off" do
      user_session(admin)
      get :show, params: { id: 0 }
      expect(response).to have_http_status(:not_found)
      batch = batch_for(admin)
      root_account.disable_feature!(:iep_scan)
      get :show, params: { id: batch.id }
      expect(response).to have_http_status(:forbidden)
    end

    it "counts files by where they are" do
      batch = batch_for(admin, 7)
      reading, failed, stale, ready, confirmed, applied, skipped = batch.imports.order(:id).to_a
      failed.update!(extraction_state: "failed", extraction_error: "no")
      stale.update_columns(updated_at: 1.hour.ago) # stale and still queued counts as failed
      [ready, confirmed, applied, skipped].each { |i| i.update!(extraction_state: "ready", extraction: { "items" => [] }) }
      confirmed.update!(student:)
      applied.update!(student:, workflow_state: "applied")
      skipped.update!(workflow_state: "discarded", data: nil, extraction: nil)
      reading.update!(extraction_state: "running")

      user_session(admin)
      get :show, params: { id: batch.id }
      expect(json["counts"]).to eq("reading" => 1, "ready" => 1, "failed" => 2, "confirmed" => 1, "applied" => 1, "skipped" => 1)
      expect(json["files"].size).to eq 7
    end
  end

  describe "GET 'index'" do
    let(:counts) { { "reading" => 0, "ready" => 0, "failed" => 0, "confirmed" => 0, "applied" => 0, "skipped" => 0 } }

    it "lists only the user's own batches, newest first, with counts and whether any file is still open" do
      older = batch_for(admin, 2)
      older.update_columns(created_at: 2.days.ago)
      older.imports.each { |i| i.update!(workflow_state: "discarded", data: nil, extraction: nil) }
      newer = batch_for(admin, 1)
      batch_for(account_admin_user(account: root_account), 1) # someone else's
      user_session(admin)

      get :index
      expect(response).to be_successful
      expect(json.keys).to eq ["batches"]
      expect(json["batches"].pluck("id")).to eq [newer.id, older.id]
      expect(json["batches"].first).to eq("id" => newer.id,
                                          "created_at" => newer.reload.created_at.iso8601,
                                          "counts" => counts.merge("reading" => 1),
                                          "open" => true)
      expect(json["batches"].last).to include("open" => false, "counts" => counts.merge("skipped" => 2))
    end

    it "calls a batch closed once every file is applied, skipped or undone, and open while one failed" do
      done = batch_for(admin, 3)
      a, b, c = done.imports.order(:id).to_a
      a.update!(workflow_state: "applied")
      b.update!(workflow_state: "undone")
      c.update!(workflow_state: "discarded")
      failing = batch_for(admin, 1)
      failing.imports.first.update!(extraction_state: "failed", extraction_error: "no")
      user_session(admin)
      get :index
      by_id = json["batches"].index_by { |batch| batch["id"] }
      expect(by_id[done.id]["open"]).to be false
      expect(by_id[failing.id]["open"]).to be true
    end

    it "leaves out batches older than the retention window" do
      old = batch_for(admin, 1)
      old.update_columns(created_at: 8.days.ago)
      user_session(admin)
      get :index
      expect(json["batches"]).to eq []
    end

    it "is refused while the flag is off, and to someone who can't manage any student" do
      user_session(admin)
      root_account.disable_feature!(:iep_scan)
      get :index
      expect(response).to have_http_status(:forbidden)
      root_account.enable_feature!(:iep_scan)
      user_session(user_factory(active_all: true))
      get :index
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "when the viewer has lost access" do
    let(:manager) do
      role = custom_account_role("Case manager", account: root_account)
      root_account.role_overrides.create!(permission: "supports_manage_plans", role:, enabled: true)
      user_factory(active_all: true).tap do |u|
        root_account.account_users.create!(user: u, role:)
        Supports::Caseload.create!(root_account:, staff_id: u.id, student_id: student.id)
      end
    end

    it "refuses the uploader of an unmatched batch once they can't manage anyone" do
      batch = batch_for(manager, 1)
      Supports::Caseload.where(staff_id: manager.id).delete_all
      user_session(manager)
      get :show, params: { id: batch.id }
      expect(response).to have_http_status(:forbidden)
    end

    it "omits, rather than hides, a file whose confirmed student they can no longer manage" do
      other = user_factory(active_all: true, name: "Olga Other").tap { |u| u.pseudonyms.create!(unique_id: "olga@example.com", account: root_account) }
      Supports::Caseload.create!(root_account:, staff_id: manager.id, student_id: other.id)
      batch = batch_for(manager, 2)
      first, second = batch.imports.order(:id).to_a
      first.update!(student:)
      second.update!(student: other)
      Supports::Caseload.where(staff_id: manager.id, student_id: other.id).delete_all
      user_session(manager)
      get :show, params: { id: batch.id }
      expect(json["files"].pluck("id")).to eq [first.id]
      expect(json["counts"].values.sum).to eq 1
      expect(response.body).not_to include("Olga")
    end
  end

  describe "what a poll loads" do
    it "serializes the files without loading their documents" do
      batch = batch_for(admin, 2)
      seen = []
      allow_any_instance_of(Supports::Import).to receive(:as_api_json).and_wrap_original do |original, *args, **kwargs|
        seen << original.receiver.has_attribute?(:data)
        original.call(*args, **kwargs)
      end
      user_session(admin)
      get :show, params: { id: batch.id }
      expect(seen).to eq [false, false]
      expect(json["files"].pluck("filename")).to match_array %w[f0.pdf f1.pdf]
      expect(response.body).not_to include("SECRET-DOC")
    end
  end
end
