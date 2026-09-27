# frozen_string_literal: true

#
# Copyright (C) 2013 - present Instructure, Inc.
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

require_relative "../report_spec_helper"

describe "BaseOutcomeReport" do
  include ReportSpecHelper

  before(:once) do
    @root_account = Account.create(name: "New Account", default_time_zone: "UTC")
    @user1 = user_with_managed_pseudonym(
      active_all: true,
      account: @root_account,
      name: "John St. Clair",
      sortable_name: "St. Clair, John",
      username: "john@stclair.com",
      sis_user_id: "user_sis_id_01"
    )
    @course1 = Course.create(name: "English 101", course_code: "ENG101", account: @root_account)
  end

  let(:account_report) { AccountReport.new(report_type: "outcome_export_csv", account: @root_account, user: @user1) }
  let(:report) { AccountReports::ImprovedOutcomeReports::BaseOutcomeReport.new(account_report) }

  describe "#determine_order_key" do
    [
      ["users", "users"],
      ["courses", "courses"],
      ["outcomes", "outcomes"],
      ["invalid", nil],
      [nil, nil]
    ].each do |order_key, expected|
      it "returns #{expected.inspect} when param is #{order_key.inspect}" do
        account_report.parameters = { "order" => order_key }
        account_report.save
        expect(report.send(:determine_order_key)).to eq(expected)
      end
    end
  end

  describe "#outcome_order" do
    [
      [nil, "u.id, learning_outcomes.id, c.id"],
      ["users", "u.id, learning_outcomes.id, c.id"],
      ["courses", "c.id, u.id, learning_outcomes.id"],
      ["outcomes", "learning_outcomes.id, u.id, c.id"],
      ["invalid", "u.id, learning_outcomes.id, c.id"]
    ].each do |order_key, expected|
      it "returns #{expected.inspect} when order key is #{order_key.inspect}" do
        account_report.parameters = { "order" => order_key }
        account_report.save
        expect(report.send(:outcome_order)).to eq(expected)
      end
    end
  end

  describe "#write_outcomes_report" do
    let(:headers) { ["student name", "student id", "course id", "learning outcome id", "submission date"] }
    let(:config_options) { {} }
    let(:csv) { [] }
    let(:canvas_scope) do
      instance_double(ActiveRecord::Relation).tap do |scope|
        allow(scope).to receive(:find_each) do |&block|
          (1..3).each do |i|
            record = instance_double(ActiveRecord::Base, attributes: {
                                       "student id" => i,
                                       "course id" => i,
                                       "learning outcome id" => i,
                                       "submission date" => Time.now.utc + i.days
                                     })
            allow(record).to receive(:[]).with("student id").and_return(i)
            allow(record).to receive(:[]).with("course id").and_return(i)
            allow(record).to receive(:[]).with("learning outcome id").and_return(i)
            allow(record).to receive(:[]).with("submission date").and_return(Time.now.utc + i.days)
            block.call(record)
          end
        end
        except_scope = instance_double(ActiveRecord::Relation)
        allow(scope).to receive(:except).with(:select).and_return(except_scope)
        allow(except_scope).to receive(:count).and_return(1)
      end
    end

    def write_report(headers, enable_i18n_features: false, replica: :report)
      csv_mock = []
      csv_mock << headers unless headers.nil?
      yield csv_mock if block_given?
      csv_mock
    end

    before do
      allow(report).to receive(:write_report) do |headers, enable_i18n_features: false, replica: :report, &block|
        csv_mock = write_report(headers, enable_i18n_features:, replica:, &block)
        csv.concat(csv_mock)
      end
      allow(GuardRail).to receive(:activate).with(:primary).and_yield
      allow(GuardRail).to receive(:activate).with(:secondary).and_yield
      allow(account_report).to receive(:update_attribute).with(:current_line, csv.length)
    end

    it "writes the report with the correct headers" do
      report.send(:write_outcomes_report, headers, canvas_scope, config_options)
      expect(csv.first).to eq(headers)
    end

    it "does not skip any record" do
      report.send(:write_outcomes_report, headers, canvas_scope, config_options)
      expect(csv.length).to eq(4)
    end

    it "processes each record with post_process_record if provided" do
      # Stub the post_process_record method
      allow(self).to receive(:post_process_record).and_wrap_original do |_original_method, record, _cache|
        record.merge("student name" => "Processed John Doe #{record["course id"]}")
      end

      # Assign the method to config_options
      config_options[:post_process_record] = method(:post_process_record)

      # Execute the method
      report.send(:write_outcomes_report, headers, canvas_scope, config_options)

      # Verify that the method was called exactly 3 times
      expect(self).to have_received(:post_process_record).exactly(3).times

      # Additional assertions
      expect(csv.length).to eq(4)
      expect(csv[1]).to include("Processed John Doe 1")
      expect(csv[2]).to include("Processed John Doe 2")
      expect(csv[3]).to include("Processed John Doe 3")
    end

    it "skips records that raise ActiveRecord::RecordInvalid" do
      # Stub the post_process_record method
      allow(self).to receive(:post_process_record).and_wrap_original do |_original_method, record, _cache|
        raise ActiveRecord::RecordInvalid if record["course id"].odd?

        record.merge("student name" => "Processed John Doe #{record["course id"]}")
      end

      # Assign the method to config_options
      config_options[:post_process_record] = method(:post_process_record)

      # Execute the method
      report.send(:write_outcomes_report, headers, canvas_scope, config_options)

      # Verify that the method was called exactly 3 times
      expect(self).to have_received(:post_process_record).exactly(3).times

      # Additional assertions
      expect(csv.length).to eq(2) # Only headers and Record #2 should be present
      expect(csv[1]).to include("Processed John Doe 2")
    end

    it "writes a message if no records are found" do
      allow(canvas_scope).to receive(:find_each)
      allow(canvas_scope.except(:select)).to receive(:count).and_return(0)
      report.send(:write_outcomes_report, headers, canvas_scope, config_options)
      expect(csv.last).to eq(["No outcomes found"])
    end
  end

  describe "#add_outcomes_data" do
    it "doesn't load courses if account_level_mastery_scales feature is off" do
      report.instance_variable_set(:@account_level_mastery_scales_enabled, false)
      row = { "course id" => @course1.id }
      expect(Course).not_to receive(:find)
      report.send :add_outcomes_data, row
    end

    it "caches courses" do
      report.instance_variable_set(:@account_level_mastery_scales_enabled, true)
      row = { "course id" => @course1.id }
      expect(Course).to receive(:find).with(@course1.id).and_call_original
      report.send :add_outcomes_data, row
      expect(Course).not_to receive(:find)
      report.send :add_outcomes_data, row
    end
  end
end
