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

# The Supports page (docs/teacher-workflow-plan.md Phase 1): the viewer's
# caseload, plan editing, the accommodation catalog and imports.
module Supports
  class CaseloadController < BaseController
    # GET /supports
    def page
      return render_unauthorized_action unless page_allowed?

      @page_title = t("Supports")
      add_crumb t("Supports")
      add_body_class("full-width")
      js_env({ SUPPORTS: {
               can_see_all: caseload_view.can_see_all?,
               can_import: import_accounts.any?,
               can_scan: can_scan?,
               scan_account_id: can_scan? ? @domain_root_account.id.to_s : nil,
               import_accounts: import_accounts.map { |account| { id: account.id.to_s, name: account.name } },
               can_manage_catalog: @domain_root_account.grants_right?(@current_user, :supports_manage_catalog),
               record_mode: Supports.record_mode(@domain_root_account)
             } })
      js_bundle :supports
      render html: '<div id="supports_app"></div>'.html_safe, layout: true
    end

    # GET /api/v1/supports/caseload?scope=mine|all
    def index
      return render_unauthorized_action unless caseload_view.allowed?

      render json: { rows: caseload_view.rows, can_see_all: caseload_view.can_see_all? }
    end

    private

    def caseload_view
      @caseload_view ||= CaseloadView.new(@current_user, @domain_root_account, real_user:, scope: params[:scope])
    end

    def import_accounts
      @import_accounts ||= Account.where(id: @current_user.account_users.active.select(:account_id))
                                  .where("accounts.id = ? OR accounts.root_account_id = ?", @domain_root_account.id, @domain_root_account.id)
                                  .select { |account| Importer.allowed?(@current_user, account) }
    end

    # IEP scanning is on and the viewer manages plans. Each scan is still
    # checked against its student.
    def can_scan?
      return @can_scan if defined?(@can_scan)

      @can_scan = Supports.feature_enabled?(@domain_root_account, :iep_scan) &&
                  @domain_root_account.grants_right?(@current_user, :supports_manage_plans)
    end

    def page_allowed?
      caseload_view.allowed? || import_accounts.any? ||
        @domain_root_account.grants_right?(@current_user, :supports_manage_catalog)
    end
  end
end
