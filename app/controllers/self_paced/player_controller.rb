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

# The student course player (docs/fork-plan.md §2.4): the course map page at
# /courses/:course_id/player, and the map API it and the player bar read.
module SelfPaced
  class PlayerController < ApplicationController
    before_action :require_context
    before_action :require_player_course

    # GET /courses/:course_id/player
    def show
      return unless authorized_action(@context, @current_user, :read)

      @self_paced_player_page = true
      @show_left_side = false
      @page_title = @context.name
      js_env({ SELF_PACED_PLAYER: { map_url: api_v1_course_self_paced_map_path(@context), course_color: self_paced_course_color } })
      js_bundle :self_paced_player
      render html: '<div id="self_paced_player"></div>'.html_safe, layout: true
    end

    # GET /api/v1/courses/:course_id/self_paced/map
    def map
      return unless authorized_action(@context, @current_user, :read)

      render json: PlayerMap.new(@context, @current_user).as_json
    end

    private

    def require_player_course
      render_unauthorized_action unless Gating.player_course?(@context)
    end
  end
end
