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

# Receives activity pings from students' browsers in self-paced courses
# (ui/shared/self-paced/activityTracker.ts).
#
# Always answers 204, whether or not the ping was recorded, so the browser
# never needs to care. Pings are ignored unless the user is a real student in
# the course (not a teacher acting as one, not the test student) and activity
# tracking is on.
module SelfPaced
  class ActivityController < ApplicationController
    before_action :require_user
    before_action :require_context
    before_action :disable_page_views
    # a heartbeat from an idle tab must not count as Canvas "activity"
    skip_after_action :update_enrollment_last_activity_at

    def create
      if trackable?
        content_tag = ContentTagResolver.resolve(@context, module_item_id: params[:module_item_id], path: params[:path])
        ActivityLedger.record_ping(user: @current_user, course: @context, seconds: params[:seconds], content_tag:)
        enqueue_first_refresh
      end
      head :no_content
    end

    private

    def trackable?
      @context.is_a?(Course) &&
        @real_current_user.nil? &&
        !@current_user.fake_student? &&
        SelfPaced.feature_enabled?(@context, :self_paced_activity_tracking) &&
        @context.user_is_student?(@current_user)
    end

    # The ping may have just created the student's state row; fill in its
    # progress columns straight away rather than waiting for the nightly job.
    def enqueue_first_refresh
      return unless StudentCourseState.where(course: @context, user: @current_user, refreshed_at: nil).exists?

      StateRefresher.enqueue(root_account_id: @context.root_account_id, course_id: @context.id, user_id: @current_user.id)
    end
  end
end
