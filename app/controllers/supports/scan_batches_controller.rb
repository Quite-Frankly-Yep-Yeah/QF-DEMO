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

# Uploading many IEPs at once (docs/superpowers/specs/2026-10-02-iep-bulk-scan-design.md).
# A batch is the uploader's own: nobody else, an admin included, can read it,
# because its scans have no student to scope access by until one is confirmed.
module Supports
  class ScanBatchesController < BaseController
    before_action :find_account
    before_action :require_scan_flag, only: :show

    # GET /api/v1/supports/scan_batches/:id   how a batch's progress is polled
    def show
      batch = ScanBatch.find_by(id: params[:id], account_id: @account.id, user_id: @current_user.id)
      return render json: { message: t("Batch not found.") }, status: :not_found unless batch

      render json: batch_json(batch)
    end

    # POST /api/v1/supports/scan_batches   account_id, files[] (PDF, PNG or JPEG)
    def create
      files = uploads
      render json: batch_json(IepScan.new(@account, @current_user).create_batch!(files:))
    rescue IepScan::Invalid => e
      render json: { errors: [e.message] }, status: :unprocessable_content
    end

    private

    # The scans as their uploader sees them, and how many are in each state.
    def batch_json(batch)
      files = batch.imports.order(:id).map(&:as_api_json)
      { id: batch.id, files:, counts: counts(files) }
    end

    # reading: queued or running. ready: read, no student. confirmed: read, student attached.
    # skipped: discarded (or undone, which leaves nothing in effect).
    def counts(files)
      counts = { reading: 0, ready: 0, failed: 0, confirmed: 0, applied: 0, skipped: 0 }
      files.each { |file| counts[state_of(file)] += 1 }
      counts
    end

    def state_of(file)
      case file[:workflow_state]
      when "applied" then :applied
      when "discarded", "undone" then :skipped
      else
        case file[:extraction_state]
        when "failed" then :failed
        when "ready" then file[:student] ? :confirmed : :ready
        else :reading
        end
      end
    end

    # The uploaded files; anything that isn't one refuses the whole batch.
    def uploads
      list = params[:files]
      list = list.values if list.respond_to?(:values) && !list.is_a?(Array)
      list = Array(list)
      raise IepScan::Invalid, t("Choose a PDF, PNG or JPEG file.") unless list.all? { |file| file.respond_to?(:read) }

      list
    end

    def require_scan_flag
      return if Supports.feature_enabled?(@account, :iep_scan)

      render json: { message: t("IEP scanning isn't turned on.") }, status: :forbidden
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
  end
end
