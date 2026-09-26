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

# Tells the browser to start the self-paced activity pinger
# (ui/shared/self-paced/activityTracker.ts) on course pages for
# students, when activity tracking is on.
module SelfPaced
  module ActivityTracking
    private

    def self_paced_activity_env
      return unless @context.is_a?(Course) && @current_user && @real_current_user.nil?
      return if @current_user.fake_student?
      return unless SelfPaced.feature_enabled?(@context, :self_paced_activity_tracking)
      return unless @context.user_is_student?(@current_user)

      {
        ping_url: api_v1_course_self_paced_activity_path(@context),
        module_item_id: params[:module_item_id].presence
      }
    end
  end
end
