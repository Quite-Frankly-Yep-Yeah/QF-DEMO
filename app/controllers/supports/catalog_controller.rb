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

# The school's accommodation catalog (docs/teacher-workflow-plan.md §2.3).
# Anyone who works with plans can read it; editing needs
# supports_manage_catalog on the root account. Removing an item hides it from
# new plans but keeps it on the plans that use it.
module Supports
  class CatalogController < BaseController
    before_action :require_manage_catalog, except: :index
    before_action :find_type, only: %i[update destroy]

    # GET /api/v1/supports/catalog
    def index
      return render_unauthorized_action unless can_read?

      render json: {
        types: Catalog.types(@domain_root_account).map(&:as_api_json),
        kinds: AccommodationType::KINDS.map { |kind| { kind:, label: AccommodationType.kind_label(kind) } },
        can_manage: @domain_root_account.grants_right?(@current_user, :supports_manage_catalog)
      }
    end

    # POST /api/v1/supports/catalog
    def create
      position = AccommodationType.where(root_account: @domain_root_account).maximum(:position).to_i + 1
      type = AccommodationType.new(type_params.merge(root_account: @domain_root_account, position:))
      type.save!
      render json: type.as_api_json
    end

    # PUT /api/v1/supports/catalog/:id
    def update
      @type.update!(type_params)
      render json: @type.as_api_json
    end

    # DELETE /api/v1/supports/catalog/:id
    def destroy
      @type.update!(workflow_state: "deleted")
      head :no_content
    end

    private

    def can_read?
      @domain_root_account.grants_right?(@current_user, :supports_manage_catalog) ||
        Account.where(id: @current_user.account_users.active.select(:account_id))
               .where("accounts.id = ? OR accounts.root_account_id = ?", @domain_root_account.id, @domain_root_account.id)
               .any? { |account| account.grants_right?(@current_user, :supports_manage_plans) }
    end

    def require_manage_catalog
      render_unauthorized_action unless @domain_root_account.grants_right?(@current_user, :supports_manage_catalog)
    end

    def find_type
      @type = AccommodationType.active.find_by(id: params[:id], root_account_id: @domain_root_account.id)
      render json: { message: t("Accommodation not found.") }, status: :not_found unless @type
    end

    def type_params
      permitted = params.permit(:name, :kind, :instructions, default_parameters: %i[multiplier minutes percent mode attempts every_days setting])
      permitted[:default_parameters] = permitted[:default_parameters].to_h.compact_blank if permitted.key?(:default_parameters)
      permitted
    end
  end
end
