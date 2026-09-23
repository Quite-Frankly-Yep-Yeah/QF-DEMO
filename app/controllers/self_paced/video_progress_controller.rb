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

# Receives video watching progress from the course player bar
# (ui/shared/self-paced/videoTracker.ts). Only real students count; teachers,
# admins acting as students and the test student are ignored.
module SelfPaced
  class VideoProgressController < ApplicationController
    before_action :require_user
    before_action :require_context
    before_action :disable_page_views

    # POST /api/v1/courses/:course_id/self_paced/video_progress
    def create
      tag = @context.context_module_tags.not_deleted.find_by(id: params[:module_item_id])
      return render json: { message: "module item not found" }, status: :not_found unless tag
      return head :no_content unless recordable?

      progress = VideoProgressRecorder.record(user: @current_user,
                                              course: @context,
                                              tag:,
                                              fraction: params[:fraction],
                                              duration: params[:duration])
      render json: { max_fraction: progress&.max_fraction.to_f, completed: progress&.completed_at.present? }
    end

    private

    def recordable?
      Gating.player_course?(@context) &&
        @real_current_user.nil? &&
        !@current_user.fake_student? &&
        @context.user_is_student?(@current_user)
    end
  end
end
