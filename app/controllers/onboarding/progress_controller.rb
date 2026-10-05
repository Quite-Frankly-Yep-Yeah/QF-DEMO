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

# The onboarding checklists for the signed-in person (docs/onboarding-plan.md).
# Only tracks available to them are listed or changed; anything else is a 404,
# so the API never says which tracks exist for other roles.
module Onboarding
  class ProgressController < ApplicationController
    before_action :require_user
    before_action :find_track, except: :index

    # GET /api/v1/users/self/onboarding
    def index
      tracks = Tracks.available(@current_user, @domain_root_account)
      render json: { tracks: tracks.map { |t| Checklist.new(t, @current_user, @domain_root_account).summary_json } }
    end

    # GET /api/v1/users/self/onboarding/:track
    def show
      render json: checklist.as_json
    end

    # PUT /api/v1/users/self/onboarding/:track/steps/:step   done, dismissed (booleans)
    def update
      step = @track.step(params[:step])
      return render json: { errors: [t("No such step")] }, status: :not_found unless step

      checklist.mark(step, done: flag(:done), dismissed: flag(:dismissed))
      render json: checklist.as_json
    end

    # DELETE /api/v1/users/self/onboarding/:track   starts the track over
    def destroy
      checklist.reset!
      render json: checklist.as_json
    end

    private

    def find_track
      @track = Tracks.available(@current_user, @domain_root_account).find { |t| t.key == params[:track] }
      render json: { errors: [t("No such checklist")] }, status: :not_found unless @track
    end

    def checklist
      @checklist ||= Checklist.new(@track, @current_user, @domain_root_account)
    end

    def flag(name)
      return nil unless params.key?(name)

      value_to_boolean(params[name])
    end
  end
end
