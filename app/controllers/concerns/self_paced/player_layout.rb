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

# Replaces the standard course navigation for students in course player
# courses (docs/fork-plan.md §2.4):
#
# - the course home and modules pages send them to the course map
# - every other course page hides the course menu and shows the player bar
#   (progress, course map, previous and next)
#
# Teachers keep the normal course. Add ?force_classic=1 to see a page without
# the player.
module SelfPaced
  module PlayerLayout
    def self.included(base)
      base.helper_method :self_paced_player_layout!
    end

    private

    def self_paced_player_request?
      return @self_paced_player_request if defined?(@self_paced_player_request)

      @self_paced_player_request =
        @context.is_a?(Course) &&
        @current_user.present? &&
        !api_request? &&
        !Canvas::Plugin.value_to_boolean(params[:force_classic]) &&
        Gating.player_course?(@context) &&
        @context.user_is_student?(@current_user, include_fake_student: true)
    end

    # Called from the course home and modules pages. Returns true when it
    # redirected, so callers can `return if self_paced_player_redirect`.
    def self_paced_player_redirect
      return false unless self_paced_player_request?

      redirect_to course_self_paced_player_path(@context)
      true
    end

    # Called from the layout while it decides on the course menu. Returns true
    # when the course menu should be hidden; the layout sets @show_left_side
    # itself, because helper methods run on the controller, not the view.
    def self_paced_player_layout!
      return false unless self_paced_player_request?

      body_classes << "self-paced-player"
      return true if @self_paced_player_page

      tag = ContentTagResolver.resolve(@context, module_item_id: params[:module_item_id], path: request.path)
      watch_fraction = tag && ItemSetting.where(content_tag_id: tag.id).pick(:watch_fraction)
      js_env({ SELF_PACED_PLAYER_BAR: {
               map_url: api_v1_course_self_paced_map_path(@context),
               player_url: course_self_paced_player_path(@context),
               module_item_id: tag&.id&.to_s,
               course_color: self_paced_course_color,
               watch_fraction:,
               video_progress_url: api_v1_course_self_paced_video_progress_path(@context)
             } })
      js_bundle :self_paced_player_bar
      true
    end

    # The color the student picked for this course on their quite frankly an example LMS dashboard,
    # if any; the player uses it as the course's accent.
    def self_paced_course_color
      colors = @current_user&.get_preference(:custom_colors)
      colors.is_a?(Hash) ? colors[@context.asset_string] || colors[@context.asset_string.to_sym] : nil
    end
  end
end
