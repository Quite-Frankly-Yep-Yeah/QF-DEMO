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
    before_action :find_import, only: %i[show review retry document apply undo destroy student]
    before_action :require_csv_rights

    # GET /api/v1/supports/imports?account_id=
    def index
      # a scan with no student yet is its uploader's alone, even from other admins
      imports = Import.where(account: @account).without_data.where("student_id IS NOT NULL OR user_id = ?", @current_user.id)
                      .order(created_at: :desc).limit(LISTED)
      render json: { imports: imports.map { |i| i.as_api_json(viewer: @current_user) } }
    end

    # GET /api/v1/supports/imports/:id (for a scan, also how its progress is polled)
    def show
      scanner.authorize_import!(@import) if @import.scan?
      render json: @import.as_api_json(viewer: @current_user)
    end

    # POST /api/v1/supports/imports   account_id, file (CSV upload)
    def create
      return create_scan if params[:student_id].present?

      file = params[:file]
      return render json: { errors: [t("Choose a CSV file.")] }, status: :unprocessable_content unless file.respond_to?(:read)
      return render json: { errors: [t("The file is larger than 2 MB.")] }, status: :unprocessable_content if file.size > MAX_BYTES

      text = file.read.force_encoding("UTF-8")
      return render json: { errors: [t("The file isn't UTF-8 text.")] }, status: :unprocessable_content unless text.valid_encoding?

      import = importer.preview!(text, filename: file.try(:original_filename))
      render json: import.as_api_json(viewer: @current_user)
    end

    # PUT /api/v1/supports/imports/:id/student   student_id: the student a person confirmed for a scan
    def student
      return render_scan_not_found unless @import.scan?

      scanner.authorize_import!(@import)
      student = User.find_by(id: params[:student_id])
      # a missing student is answered like one the user may not manage, so ids can't be probed
      raise Importer::Forbidden unless student

      render json: scanner.confirm_student!(@import, student).as_api_json(viewer: @current_user)
    rescue ArgumentError => e
      render json: { errors: [e.message] }, status: :conflict
    end

    # PUT /api/v1/supports/imports/:id/review   the reviewer's edits to an IEP scan
    def review
      return render_scan_not_found unless @import.scan?

      render json: scanner.update_review!(@import, **review_params).as_api_json(viewer: @current_user)
    rescue IepScan::Invalid => e
      render json: { errors: [e.message] }, status: :unprocessable_content
    rescue ArgumentError => e
      render json: { errors: [e.message] }, status: :conflict # includes IepScan::StudentNotConfirmed
    end

    # POST /api/v1/supports/imports/:id/retry   read a failed IEP scan again
    def retry
      return render_scan_not_found unless @import.scan?

      render json: scanner.retry!(@import).as_api_json(viewer: @current_user)
    rescue ArgumentError => e
      render json: { errors: [e.message] }, status: :conflict
    end

    # GET /api/v1/supports/imports/:id/document   the original IEP file; each read is logged
    def document
      return render_scan_not_found unless @import.scan? && @import.data.present?

      scanner.authorize_import!(@import)
      # a scan with no student yet is its uploader's own file, and no student's record is read
      return send_original unless @import.student

      access = Access.new(@current_user, @import.student, @import.root_account)
      return render_forbidden unless access.view!(:documents, subject: :iep_scan, real_user:)

      send_original
    end

    # POST /api/v1/supports/imports/:id/apply
    def apply
      return render json: { errors: [t("This import was already applied or discarded.")] }, status: :conflict unless @import.workflow_state == "previewed"

      render json: (@import.scan? ? scanner : importer).apply!(@import).as_api_json(viewer: @current_user)
    rescue IepScan::StudentNotConfirmed => e
      render json: { errors: [e.message] }, status: :conflict
    rescue ArgumentError => e
      raise unless @import&.scan?

      render json: { errors: [e.message] }, status: :unprocessable_content
    end

    # POST /api/v1/supports/imports/:id/undo
    def undo
      return render json: { errors: [t("Only an applied import can be undone.")] }, status: :conflict unless @import.workflow_state == "applied"

      render json: (@import.scan? ? scanner : importer).undo!(@import).as_api_json(viewer: @current_user)
    rescue IepScan::StudentNotConfirmed => e
      render json: { errors: [e.message] }, status: :conflict
    end

    # DELETE /api/v1/supports/imports/:id (discard a preview)
    def destroy
      return render json: { errors: [t("Only a preview can be discarded.")] }, status: :conflict unless @import.workflow_state == "previewed"

      scanner.authorize_import!(@import) if @import.scan?
      # a preview that was never applied belongs to no plan, so nothing keeps the file
      @import.update!(workflow_state: "discarded", data: nil, extraction: nil)
      render json: @import.as_api_json(viewer: @current_user)
    end

    private

    def send_original
      send_data Base64.strict_decode64(@import.data),
                type: @import.content_type,
                filename: @import.filename.presence || "iep",
                disposition: "attachment"
    end

    def importer
      @importer ||= Importer.new(@account, @current_user)
    end

    def scanner
      @scanner ||= IepScan.new(@account, @current_user)
    end

    # POST with a student_id: an IEP scan instead of a CSV
    def create_scan
      student = User.find_by(id: params[:student_id])
      return render json: { message: t("Student not found.") }, status: :not_found unless student

      file = params[:file]
      return render json: { errors: [t("Choose a PDF, PNG or JPEG file.")] }, status: :unprocessable_content unless file.respond_to?(:read)

      render json: scanner.create!(student:, file:).as_api_json(viewer: @current_user)
    rescue IepScan::Invalid => e
      render json: { errors: [e.message] }, status: :unprocessable_content
    end

    def review_params
      permitted = params.permit(:acknowledged_mismatch,
                                keep_unmapped: [],
                                plan: %i[plan_type start_date end_date],
                                items: [:index, :included, { params: {} }])
      boolean = ActiveModel::Type::Boolean.new
      edits = {}
      edits[:items] = permitted[:items].map { |item| item.to_h.tap { |h| h["included"] = boolean.cast(h["included"]) if h.key?("included") } } if permitted.key?(:items)
      edits[:plan] = permitted[:plan].to_h if permitted.key?(:plan)
      edits[:keep_unmapped] = permitted[:keep_unmapped] if permitted.key?(:keep_unmapped)
      edits[:acknowledged_mismatch] = boolean.cast(permitted[:acknowledged_mismatch]) if permitted.key?(:acknowledged_mismatch)
      edits
    end

    def render_scan_not_found
      render json: { message: t("Import not found.") }, status: :not_found
    end

    # A scan is checked against its student (Supports::IepScan); everything
    # else here is for people who manage every student's plans.
    def require_csv_rights
      scan = @import ? @import.scan? : (action_name == "create" && params[:student_id].present?)
      render_unauthorized_action unless scan || Importer.allowed?(@current_user, @account)
    end

    def find_account
      @account = if params[:account_id].present?
                   Account.find_by(id: params[:account_id])
                 else
                   @domain_root_account
                 end
      valid = @account && (@account.id == @domain_root_account.id || @account.root_account_id == @domain_root_account.id)
      render_unauthorized_action unless valid
    end

    def find_import
      @import = Import.find_by(id: params[:id], account_id: @account.id)
      render json: { message: t("Import not found.") }, status: :not_found unless @import
    end
  end
end
