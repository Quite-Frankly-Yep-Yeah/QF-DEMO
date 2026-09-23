# frozen_string_literal: true

#
# Copyright (C) 2026 - present EXAMPLE contributors
#
# This file is part of EXAMPLE LMS, a modified version of Canvas.
#
# EXAMPLE LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

# The course player's setup API (docs/fork-plan.md §2.1). Teachers who can
# edit course content read and save per-item roles and rules; saving rewrites
# the course's module requirements (SelfPaced::CourseSetup).
module SelfPaced
  class CourseSetupController < ApplicationController
    before_action :require_user
    before_action :require_context
    before_action :require_setup_rights

    # GET /courses/:course_id/player_setup
    def page
      set_active_tab "self_paced_setup"
      @page_title = t("Course player setup")
      js_env({ SELF_PACED_SETUP: {
               setup_url: api_v1_course_self_paced_setup_path(@context),
               player_url: course_self_paced_player_path(@context)
             } })
      js_bundle :self_paced_setup
      render html: '<div id="self_paced_setup"></div>'.html_safe, layout: true
    end

    # GET /api/v1/courses/:course_id/self_paced/setup
    def show
      render json: CourseSetup.new(@context).as_json
    end

    # PUT /api/v1/courses/:course_id/self_paced/setup
    def update
      setup = CourseSetup.new(@context).apply!(setup_params)
      render json: setup.as_json
    rescue ActiveRecord::RecordInvalid => e
      render json: { errors: e.record.errors.full_messages }, status: :unprocessable_content
    end

    private

    def require_setup_rights
      return render_unauthorized_action unless Gating.player_course?(@context)

      authorized_action(@context, @current_user, RoleOverride::GRANULAR_MANAGE_COURSE_CONTENT_PERMISSIONS)
    end

    def setup_params
      params.permit(:mastery_threshold,
                    :provisional_checks,
                    items: %i[id role estimated_minutes mastery_threshold watch_fraction max_attempts retake_review])
    end
  end
end
