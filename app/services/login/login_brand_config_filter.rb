# frozen_string_literal: true

#
# Copyright (C) 2023 - present Instructure, Inc.
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

class Login::LoginBrandConfigFilter
  ALLOWED_LOGIN_VARS = %w[
    ic-brand-Login-logo
    ic-brand-Login-body-bgd-image
    ic-brand-Login-body-bgd-color
    ic-brand-Login-custom-message
  ].freeze

  CUSTOM_MESSAGE_GROUPS = %w[discovery registration].freeze

  def self.filter(variable_schema, account)
    custom_labels_enabled = Account.site_admin.feature_enabled?(:new_login_ui_custom_labels)

    variable_schema.each_with_object([]) do |group, result|
      group_key = group["group_key"]

      if group_key == "login"
        filter_login_group_variables(group, custom_labels_enabled)
      end

      if custom_labels_enabled
        next if group_key == "registration" && !account.self_registration?
        next if group_key == "discovery" && !account.discovery_page_allowed?
      elsif CUSTOM_MESSAGE_GROUPS.include?(group_key)
        next
      end

      result << group
    end
  end

  class << self
    private

    def filter_login_group_variables(group, custom_labels_enabled)
      group["variables"].reject! do |variable|
        variable_name = variable["variable_name"]

        # set default to "" for login logo to prevent legacy image from displaying
        # this preserves the key to satisfy frontend prop type expectations
        variable["default"] = "" if variable_name == "ic-brand-Login-logo"

        variable_name.start_with?("ic-brand-Login") && (
          !ALLOWED_LOGIN_VARS.include?(variable_name) ||
          (variable_name == "ic-brand-Login-custom-message" && !custom_labels_enabled)
        )
      end
    end
  end
end
