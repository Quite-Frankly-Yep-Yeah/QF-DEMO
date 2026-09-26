# frozen_string_literal: true

#
# Copyright (C) 2024 - present Instructure, Inc.
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

describe Permissions, type: :module do
  let(:original_permissions) { Permissions.instance_variable_get(:@permissions) }

  around do |example|
    # Store original state
    saved_permissions = Permissions.instance_variable_get(:@permissions)

    # Reset for test
    Permissions.instance_variable_set(:@permissions, nil)

    # Run test
    example.run

    # Restore original state
    Permissions.instance_variable_set(:@permissions, saved_permissions)
  end

  describe ".register" do
    it "registers permissions correctly" do
      permissions = { read: { description: "Read Permission" }, write: { description: "Write Permission" } }
      Permissions.register(permissions)
      expect(Permissions.retrieve).to eq(permissions)
    end

    it "raises an error if trying to register permissions after the hash is frozen" do
      Permissions.retrieve.freeze
      expect do
        Permissions.register(read: { description: "Read Permission" })
      end.to raise_error(RuntimeError, "Cannot register permissions after the application has been fully initialized")
    end

    it "logs a warning and skips the duplicate permission" do
      key = :read
      Permissions.register(key => { description: "Read Permission" })
      allow(Rails.logger).to receive(:warn)
      expect do
        Permissions.register(key => { description: "Duplicate Read Permission" })
      end.not_to raise_error
      expect(Rails.logger).to have_received(:warn).with("Duplicate permission detected: #{key}")
      # Ensure the duplicate permission is not added
      expect(Permissions.instance_variable_get(:@permissions)[key][:description]).to eq("Read Permission")
    end

    it "raises an error if the input is not a hash" do
      expect do
        Permissions.register(["read", "write"])
      end.to raise_error(RuntimeError, "Permissions.register must be called with a hash of permission(s)")
    end
  end

  describe ".retrieve" do
    let(:account) { account_model }

    it "returns the registered permissions without context" do
      permissions = { read: { description: "Read Permission" }, write: { description: "Write Permission" } }
      Permissions.register(permissions)
      expect(Permissions.retrieve).to eq(permissions)
    end

    it "returns an empty hash if no permissions are registered" do
      expect(Permissions.retrieve).to eq({})
    end

    it "freezes the permissions hash after the first call to retrieve" do
      Permissions.register(read: { description: "Read Permission" })
      Rails.application.config.after_initialize { Permissions.retrieve.freeze }
      expect(Permissions.retrieve).to be_frozen
    end

    context "without context" do
      it "returns original permissions without applying overrides" do
        permissions = { read: { label: -> { "Read" } } }
        Permissions.register(permissions)

        result = Permissions.retrieve(nil)
        expect(result[:read][:label].call).to eq("Read")
      end
    end
  end

  describe ".permission_groups" do
    let(:account) { account_model }

    before do
      # Mock PERMISSION_GROUPS constant
      stub_const("PERMISSION_GROUPS", {
                   test_group: {
                     label: -> { "Test Group" },
                     subtitle: -> { "Test subtitle" }
                   }
                 })
    end

    it "returns base permission groups without context" do
      result = Permissions.permission_groups
      expect(result).to have_key(:test_group)
      expect(result[:test_group][:label].call).to eq("Test Group")
    end
  end
end
