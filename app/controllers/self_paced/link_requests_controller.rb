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

# A parent finding their student and asking the school to link them
# (docs/fork-plan.md Phase 8). Only for accounts that aren't students or staff,
# and it can only ever add a request: an admin makes the link
# (SelfPaced::ParentsController).
module SelfPaced
  class LinkRequestsController < ApplicationController
    SEARCHES_PER_HOUR = 60

    before_action :require_user
    before_action :require_parent

    # GET /api/v1/self_paced/observer/students?q=maya lopez
    def search
      return render json: { students: [], too_many: false } if StudentFinder.parts(params[:q]).empty?
      return render json: { message: t("You've searched a lot. Try again in a while.") }, status: :too_many_requests if throttled?

      render json: StudentFinder.new(@current_user, @domain_root_account).search(params[:q])
    end

    # POST /api/v1/self_paced/observer/link_requests   student_id, note
    def create
      student = User.active.find_by(id: params[:student_id])
      unless student && StudentFinder.new(@current_user, @domain_root_account).findable?(student)
        return render json: { message: t("We couldn't find that student.") }, status: :not_found
      end

      request = LinkRequest.ask!(observer: @current_user, student:, root_account: @domain_root_account, note: params[:note])
      render json: request.as_json_for_observer, status: :created
    rescue LinkRequest::Refused => e
      render json: { message: e.message }, status: :unprocessable_content
    end

    # DELETE /api/v1/self_paced/observer/link_requests/:id, the parent changed
    # their mind
    def destroy
      request = LinkRequest.find_by(id: params[:id], observer_id: @current_user.id)
      return render json: { message: t("Request not found.") }, status: :not_found unless request

      render json: request.cancel!.as_json_for_observer
    end

    private

    def require_parent
      return if SelfPaced.feature_enabled?(@domain_root_account, :self_paced_observer_view) && ObserverView.parent_account?(@current_user)

      render_unauthorized_action
    end

    # A window that slides: someone who keeps searching stays blocked until they
    # stop for a while, which is what makes walking the school's roster slow.
    def throttled?
      key = ["self_paced_student_search", @current_user.global_id].cache_key
      count = Rails.cache.read(key).to_i
      return true if count >= SEARCHES_PER_HOUR

      Rails.cache.write(key, count + 1, expires_in: 1.hour)
      false
    end
  end
end
