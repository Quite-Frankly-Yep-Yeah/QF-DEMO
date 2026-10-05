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

# The installer's checklist page for site admins (Onboarding::InstallTrack).
# The checklist itself comes from Onboarding::ProgressController.
module Onboarding
  class InstallStatusController < ApplicationController
    before_action :require_user

    # GET /install_status
    def show
      return render_unauthorized_action unless InstallTrack.site_manager?(@current_user)

      @page_title = t("Finish installing")
      add_crumb t("Finish installing")
      add_body_class("full-width")
      @show_left_side = false
      js_env({ INSTALL_STATUS: { track: InstallTrack::KEY } })
      js_bundle :install_status
      render html: '<div id="install_status_app"></div>'.html_safe, layout: true
    end
  end
end
