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

# Serves the Units page (ui/features/self_paced_units) in place of the modules
# page for teachers who can edit a Course Player course. Everyone else, and
# `?classic=1`, get the standard modules page.
module SelfPaced
  module StaffUnits
    private

    def self_paced_units?
      @context.is_a?(Course) &&
        @current_user.present? &&
        params[:classic].blank? &&
        Gating.player_course?(@context) &&
        @context.grants_any_right?(@current_user, *RoleOverride::GRANULAR_MANAGE_COURSE_CONTENT_PERMISSIONS)
    end

    def render_self_paced_units
      @page_title = t("Units")
      add_body_class("full-width")
      js_env({ SELF_PACED_UNITS: {
               course: { id: @context.id.to_s, name: @context.name, color: @context.course_color.presence },
               setup_url: api_v1_course_self_paced_setup_path(@context),
               classic_url: "#{course_context_modules_path(@context)}?classic=1",
               home_url: course_path(@context)
             } })
      js_bundle :self_paced_units
      render html: '<div id="self_paced_units"></div>'.html_safe, layout: true
    end
  end
end
