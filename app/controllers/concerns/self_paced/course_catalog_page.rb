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

# Serves the admin course catalog (ui/features/course_catalog) in place of the
# course list at /courses. Everyone who isn't an admin is sent to the home
# page, because the Courses item is hidden from them.
module SelfPaced
  module CourseCatalogPage
    private

    def self_paced_course_catalog?
      SelfPaced.course_catalog?(@domain_root_account)
    end

    def render_self_paced_course_catalog
      unless SelfPaced.course_catalog_admin?(@current_user, @domain_root_account)
        return redirect_to(root_path)
      end

      account = @domain_root_account
      @page_title = t("Course catalog")
      add_body_class("full-width")
      js_env({ COURSE_CATALOG: {
               account: { id: account.id.to_s, name: account.name },
               can_create: account.grants_right?(@current_user, :manage_courses_admin),
               dashboard_url: "/"
             } })
      js_bundle :course_catalog
      render html: '<div id="course_catalog"></div>'.html_safe, layout: true
    end
  end
end
