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

# Serves the observer view (ui/features/self_paced_observer) at
# /self_paced/observer, and in place of the dashboard for people who only
# observe. `/?classic=1` still opens the usual dashboard.
module SelfPaced
  module ObserverHomePage
    private

    def self_paced_observer_home?
      params[:classic].blank? && ObserverView.show_for?(@current_user, @domain_root_account)
    end

    def render_self_paced_observer_home
      @page_title = t("Your students")
      add_body_class("full-width")
      js_env({ SELF_PACED_OBSERVER: {
               data_url: api_v1_self_paced_observer_path,
               classic_url: "/?classic=1"
             } })
      js_bundle :self_paced_observer
      render html: '<div id="self_paced_observer"></div>'.html_safe, layout: true
    end
  end
end
