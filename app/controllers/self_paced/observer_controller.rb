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

# The observer (parent) view of self-paced students (docs/fork-plan.md
# Phase 8). Always the current user's own students, so there is nothing to
# authorize beyond being signed in with the view turned on.
module SelfPaced
  class ObserverController < ApplicationController
    include ObserverHomePage

    before_action :require_user

    # GET /self_paced/observer
    def show
      return render_unauthorized_action unless SelfPaced.feature_enabled?(@domain_root_account, :self_paced_observer_view)

      render_self_paced_observer_home
    end

    # GET /api/v1/self_paced/observer
    def data
      return render_unauthorized_action unless SelfPaced.feature_enabled?(@domain_root_account, :self_paced_observer_view)

      render json: ObserverView.new(@current_user).as_json
    end
  end
end
