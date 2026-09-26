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

# Serves the staff home of a self-paced course (ui/features/self_paced_course_home)
# in place of the standard course home for teachers, TAs and admins of a
# Course Player course. No sidebar; `?classic=1` opens the standard page.
module SelfPaced
  module StaffCourseHome
    private

    def self_paced_staff_home?
      @context.is_a?(Course) &&
        @current_user.present? &&
        params[:classic].blank? &&
        Gating.player_course?(@context) &&
        @context.grants_right?(@current_user, :read_as_admin)
    end

    def render_self_paced_staff_home
      @page_title = @context.name
      add_body_class("full-width")
      js_env({ SELF_PACED_COURSE_HOME: StaffHome.new(@context, @current_user).as_json.merge(classic_url: "#{course_path(@context)}?classic=1") })
      js_bundle :self_paced_course_home
      render html: '<div id="self_paced_course_home"></div>'.html_safe, layout: true
    end
  end
end
