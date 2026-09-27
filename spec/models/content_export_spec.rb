# frozen_string_literal: true

#
# Copyright (C) 2012 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

describe ContentExport do
  before :once do
    course_with_teacher(active_all: true)
    @ce = @course.content_exports.create!
  end

  def create_content_export(opts = {})
    course = course_model
    ContentExport.new({ context: course }.merge(opts))
  end

  describe "#export" do
    subject { @ce.export(synchronous: true) }

    it "records the job id" do
      allow(Delayed::Worker).to receive(:current_job).and_return(instance_double(Delayed::Job, id: 123))

      subject

      expect(@ce.reload.settings[:job_id]).to eq(123)
    end

    it "logs duration on export success" do
      allow(InstStatsd::Statsd).to receive(:timing)

      subject

      expect(InstStatsd::Statsd).to have_received(:timing).with("content_migrations.export_duration", anything, { tags: { export_type: nil, selective_export: false } }).once
    end
  end

  context "export_object?" do
    it "returns true for everything if there are no copy options" do
      expect(@ce.export_object?(@ce)).to be true
    end

    it "returns true for everything if 'everything' is selected" do
      @ce.selected_content = { everything: "1" }
      expect(@ce.export_object?(@ce)).to be true
    end

    it "returns false for nil objects" do
      expect(@ce.export_object?(nil)).to be false
    end

    it "returns true for all object types if the all_ option is true" do
      @ce.selected_content = { all_content_exports: "1" }
      expect(@ce.export_object?(@ce)).to be true
    end

    it "returns false for objects not selected" do
      @ce.save!
      @ce.selected_content = { all_content_exports: "0" }
      expect(@ce.export_object?(@ce)).to be false
      @ce.selected_content = { content_exports: {} }
      expect(@ce.export_object?(@ce)).to be false
      @ce.selected_content = { content_exports: { CC::CCHelper.create_key(@ce) => "0" } }
      expect(@ce.export_object?(@ce)).to be false
    end

    it "returns true for selected objects" do
      @ce.save!
      @ce.selected_content = { content_exports: { CC::CCHelper.create_key(@ce) => "1" } }
      expect(@ce.export_object?(@ce)).to be true
    end
  end

  context "add_item_to_export" do
    it "does not add nil" do
      @ce.add_item_to_export(nil)
      expect(@ce.selected_content).to be_empty
    end

    it "only adds data model objects" do
      @ce.add_item_to_export("hi")
      expect(@ce.selected_content).to be_empty

      @ce.selected_content = { assignments: nil }
      @ce.save!

      assignment_model
      @ce.add_item_to_export(@assignment)
      expect(@ce.selected_content[:assignments]).not_to be_empty
    end

    it "does not add objects if everything is already set" do
      assignment_model
      @ce.add_item_to_export(@assignment)
      expect(@ce.selected_content).to be_empty

      @ce.selected_content = { everything: 1 }
      @ce.save!

      @ce.add_item_to_export(@assignment)
      expect(@ce.selected_content.keys.map(&:to_s)).to eq ["everything"]
    end
  end

  context "notifications" do
    before :once do
      @ce.update_attribute(:user_id, @user.id)
      Notification.create!(name: "Content Export Finished", category: "Migration")
      Notification.create!(name: "Content Export Failed", category: "Migration")
    end

    it "sends notifications immediately" do
      communication_channel_model.confirm!

      %w[created exporting exported_for_course_copy deleted].each do |workflow|
        @ce.workflow_state = workflow
        expect { @ce.save! }.not_to change(DelayedMessage, :count)
        expect(@ce.messages_sent["Content Export Finished"]).to be_blank
        expect(@ce.messages_sent["Content Export Failed"]).to be_blank
      end

      @ce.workflow_state = "exported"
      expect { @ce.save! }.not_to change(DelayedMessage, :count)
      expect(@ce.messages_sent["Content Export Finished"]).not_to be_blank

      @ce.workflow_state = "failed"
      expect { @ce.save! }.not_to change(DelayedMessage, :count)
      expect(@ce.messages_sent["Content Export Failed"]).not_to be_blank
    end

    it "does not send emails as part of a content migration (course copy)" do
      @cm = ContentMigration.new(user: @user, copy_options: { everything: "1" }, context: @course)
      @ce.content_migration = @cm
      @ce.save!

      @ce.workflow_state = "exported"
      expect { @ce.save! }.not_to change(DelayedMessage, :count)
      expect(@ce.messages_sent["Content Export Finished"]).to be_blank

      @ce.workflow_state = "failed"
      expect { @ce.save! }.not_to change(DelayedMessage, :count)
      expect(@ce.messages_sent["Content Export Failed"]).to be_blank
    end
  end

  describe "#expired?" do
    it "marks as expired after X days" do
      ContentExport.where(id: @ce.id).update_all(created_at: 35.days.ago)
      expect(@ce.reload).to be_expired
    end

    it "does not mark new exports as expired" do
      expect(@ce.reload).not_to be_expired
    end

    it "does not mark as expired if setting is 0" do
      Setting.set("content_exports_expire_after_days", "0")
      ContentExport.where(id: @ce.id).update_all(created_at: 35.days.ago)
      expect(@ce.reload).not_to be_expired
    end

    it "does not mark expired if part of a ContentShare" do
      @teacher.sent_content_shares.create!(read_state: "read", name: "test", content_export_id: @ce.id)
      ContentExport.where(id: @ce.id).update_all(created_at: 35.days.ago, user_id: @teacher.id)
      expect(@ce.reload).not_to be_expired
    end
  end

  describe "#expired" do
    it "marks as expired after X days" do
      ContentExport.where(id: @ce.id).update_all(created_at: 35.days.ago)
      expect(ContentExport.expired.pluck(:id)).to eq [@ce.id]
    end

    it "does not mark new exports as expired" do
      expect(ContentExport.expired.pluck(:id)).to be_empty
    end

    it "does not mark as expired if setting is 0" do
      Setting.set("content_exports_expire_after_days", "0")
      ContentExport.where(id: @ce.id).update_all(created_at: 35.days.ago)
      expect(ContentExport.expired.pluck(:id)).to be_empty
    end
  end

  context "global_identifiers" do
    it "is automatically set to true" do
      cc_export = @course.content_exports.create!(export_type: ContentExport::COURSE_COPY)
      expect(cc_export.global_identifiers).to be true
    end

    it "does not set if there are any other exports in the context that weren't set" do
      prev_export = @course.content_exports.create!(export_type: ContentExport::COURSE_COPY)
      prev_export.update_attribute(:global_identifiers, false)
      cc_export = @course.content_exports.create!(export_type: ContentExport::COURSE_COPY)
      expect(cc_export.global_identifiers).to be false
    end

    it "uses global asset strings for keys if set" do
      export = @course.content_exports.create!(export_type: ContentExport::COURSE_COPY)
      a = @course.assignments.create!
      expect(a).to receive(:global_asset_string).once.and_call_original
      export.create_key(a)
    end

    it "uses local asset strings for keys if not set" do
      export = @course.content_exports.create!(export_type: ContentExport::COURSE_COPY)
      export.update_attribute(:global_identifiers, false)
      a = @course.assignments.create!
      expect(a).to receive(:asset_string).once.and_call_original
      export.create_key(a)
    end
  end

  describe "#mark_waiting_for_external_tool" do
    let(:content_export) do
      create_content_export(export_type: ContentExport::COURSE_COPY, workflow_state: "created")
    end

    it "transitions to waiting_for_external_tool" do
      expect { content_export.mark_waiting_for_external_tool }.to change { content_export.workflow_state }
        .from("created").to("waiting_for_external_tool")
    end
  end
end
