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

# CSV imports of plans and accommodations (docs/teacher-workflow-plan.md
# Phase 1): upload to preview, then apply, and undo if needed. For people who
# manage every student's plans in the account they import into.
module Supports
  class ImportsController < BaseController
    MAX_BYTES = 2.megabytes
    LISTED = 20

    before_action :find_account
    before_action :find_import, only: %i[apply undo destroy]

    # GET /api/v1/supports/imports?account_id=
    def index
      imports = Import.where(account: @account).order(created_at: :desc).limit(LISTED)
      render json: { imports: imports.map(&:as_api_json) }
    end

    # POST /api/v1/supports/imports   account_id, file (CSV upload)
    def create
      file = params[:file]
      return render json: { errors: [t("Choose a CSV file.")] }, status: :unprocessable_content unless file.respond_to?(:read)
      return render json: { errors: [t("The file is larger than 2 MB.")] }, status: :unprocessable_content if file.size > MAX_BYTES

      text = file.read.force_encoding("UTF-8")
      return render json: { errors: [t("The file isn't UTF-8 text.")] }, status: :unprocessable_content unless text.valid_encoding?

      import = importer.preview!(text, filename: file.try(:original_filename))
      render json: import.as_api_json
    end

    # POST /api/v1/supports/imports/:id/apply
    def apply
      return render json: { errors: [t("This import was already applied or discarded.")] }, status: :conflict unless @import.workflow_state == "previewed"

      render json: importer.apply!(@import).as_api_json
    end

    # POST /api/v1/supports/imports/:id/undo
    def undo
      return render json: { errors: [t("Only an applied import can be undone.")] }, status: :conflict unless @import.workflow_state == "applied"

      render json: importer.undo!(@import).as_api_json
    end

    # DELETE /api/v1/supports/imports/:id (discard a preview)
    def destroy
      return render json: { errors: [t("Only a preview can be discarded.")] }, status: :conflict unless @import.workflow_state == "previewed"

      @import.update!(workflow_state: "discarded", data: nil)
      render json: @import.as_api_json
    end

    private

    def importer
      @importer ||= Importer.new(@account, @current_user)
    end

    def find_account
      @account = if params[:account_id].present?
                   Account.find_by(id: params[:account_id])
                 else
                   @domain_root_account
                 end
      valid = @account && (@account.id == @domain_root_account.id || @account.root_account_id == @domain_root_account.id)
      render_unauthorized_action unless valid && Importer.allowed?(@current_user, @account)
    end

    def find_import
      @import = Import.find_by(id: params[:id], account_id: @account.id)
      render json: { message: t("Import not found.") }, status: :not_found unless @import
    end
  end
end
