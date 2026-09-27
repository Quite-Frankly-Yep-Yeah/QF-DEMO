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

# The school's side of parent accounts (docs/fork-plan.md Phase 8): print the
# sign-up flyer, and answer parents who asked to be linked to a student. Only
# for admins who can manage observers, since approving makes an observation
# link with the same access as one made on the People page.
module SelfPaced
  class ParentsController < ApplicationController
    ANSWERED_KEPT = 30.days
    REQUESTS_SHOWN = 200

    before_action :require_user
    before_action :require_admin

    # GET /self_paced/parents
    def show
      @page_title = t("Parents")
      add_crumb t("Parents")
      add_body_class("full-width")
      js_env({ SELF_PACED_PARENTS: {
               flyer_url: api_v1_self_paced_parents_flyer_path,
               reset_url: api_v1_self_paced_parents_flyer_reset_path,
               requests_url: api_v1_self_paced_parents_requests_path
             } })
      js_bundle :self_paced_parents
      render html: '<div id="self_paced_parents"></div>'.html_safe, layout: true
    end

    # GET /api/v1/self_paced/parents/flyer
    def flyer
      render json: ParentFlyer.build(@domain_root_account, request.base_url)
    end

    # POST /api/v1/self_paced/parents/flyer/reset, when a flyer has got out
    # to people it shouldn't have
    def reset_flyer
      ParentFlyer.reset!(@domain_root_account)
      render json: ParentFlyer.build(@domain_root_account, request.base_url)
    end

    # GET /api/v1/self_paced/parents/requests
    # The waiting ones, then the ones answered lately.
    def requests
      scope = LinkRequest.where(root_account_id: @domain_root_account.id).where.not(workflow_state: "cancelled")
      scope = scope.where("workflow_state = 'pending' OR decided_at > ?", ANSWERED_KEPT.ago)
      rows = scope.reorder(Arel.sql("workflow_state = 'pending' DESC"), created_at: :desc).limit(REQUESTS_SHOWN)
      render json: { requests: LinkRequest.admin_json(rows) }
    end

    # POST /api/v1/self_paced/parents/requests/:id/approve
    def approve
      answer(&:approve!)
    end

    # POST /api/v1/self_paced/parents/requests/:id/decline   response
    def decline
      answer { |request, admin| request.decline!(admin, params[:response]) }
    end

    private

    def require_admin
      return if SelfPaced.feature_enabled?(@domain_root_account, :self_paced_observer_view) &&
                @domain_root_account.grants_right?(@current_user, session, :manage_user_observers)

      render_unauthorized_action
    end

    def answer
      request = LinkRequest.find_by(id: params[:id], root_account_id: @domain_root_account.id)
      return render json: { message: t("Request not found.") }, status: :not_found unless request
      return render json: { message: t("Someone has already answered this request.") }, status: :conflict unless request.pending?

      yield request, @current_user
      render json: LinkRequest.admin_json([request]).first
    end
  end
end
