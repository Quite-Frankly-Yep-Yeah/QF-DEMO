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

# The grading queue page and its API (docs/superpowers/specs/2026-10-01-grading-queue-design.md).
# All the rules about who sees what live in TeacherWorkflow::GradingQueue.
module TeacherWorkflow
  class GradingQueueController < ApplicationController
    before_action :require_user
    before_action :require_flag

    # GET /api/v1/workflow/grading_queue
    def index
      render json: GradingQueue.new(@current_user,
                                    course_id: params[:course_id],
                                    unit_id: params[:unit_id],
                                    student_id: params[:student_id],
                                    held_up: params[:held_up],
                                    page: params[:page]).result
    end

    # GET /workflow/grading
    def show
      @page_title = t("Grading")
      add_body_class("full-width")
      js_env({ WORKFLOW_GRADING_QUEUE: { queue_url: api_v1_workflow_grading_queue_path } })
      js_bundle :workflow_grading_queue
      render html: '<div id="workflow_grading_queue"></div>'.html_safe, layout: true
    end

    private

    # With the flags off the page and API don't exist. A signed-in student
    # still gets an empty queue from #index, not an error: who sees what is
    # GradingQueue's job.
    def require_flag
      head :not_found unless TeacherWorkflow.queue_enabled?(@current_user, @domain_root_account)
    end
  end
end
