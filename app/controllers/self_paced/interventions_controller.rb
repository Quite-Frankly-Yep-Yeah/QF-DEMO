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

# Intervention API for the dashboard (docs/fork-plan.md §2.5). Staff can only
# act on students in courses their SelfPaced::DashboardScope includes; each
# tool then checks its own permission in SelfPaced::Intervener.
module SelfPaced
  class InterventionsController < ApplicationController
    include Api::V1::Progress

    before_action :require_user
    before_action :load_course_and_student, only: %i[index create]

    LOG_LENGTH = 50

    # GET /api/v1/self_paced/courses/:course_id/students/:student_id/interventions
    #
    # The tools the viewer can use, the log for this student in this course,
    # and every note about the student the viewer may read.
    def index
      intervener = Intervener.new(@course, @current_user)
      tools = intervener.tools
      log = Intervention.where(course: @course, student: @student)
                        .order(created_at: :desc, id: :desc)
                        .limit(LOG_LENGTH)
                        .preload(:actor, :real_actor, :content_tag)
      render json: {
        tools:,
        log: log.map(&:as_json_for_log),
        notes: tools[:note] ? notes_json : []
      }
    end

    # POST /api/v1/self_paced/courses/:course_id/students/:student_id/interventions
    #   kind, content_tag_id, reason, and per kind: attempts, override_kind,
    #   target_date, reset, body, subject, note_id
    def create
      intervention = Intervener.new(@course, @current_user, real_actor: @real_current_user)
                               .perform(params[:kind],
                                        student: @student,
                                        content_tag: params[:content_tag_id],
                                        reason: params[:reason],
                                        **tool_options)
      render json: { intervention: intervention.as_json_for_log, notes: intervention.kind.include?("note") ? notes_json : nil }.compact
    rescue Intervener::Denied => e
      render json: { errors: [e.message] }, status: :forbidden
    rescue Intervener::Invalid => e
      render json: { errors: [e.message] }, status: :unprocessable_content
    end

    # POST /api/v1/self_paced/interventions/bulk
    #   kind, targets[] ({course_id, student_id}), content_tag_id (an id or
    #   "current"), and the kind's options. Returns a Progress.
    def bulk
      kind = params[:kind].to_s
      return render json: { errors: ["this action can't be done in bulk"] }, status: :bad_request unless BulkIntervention::KINDS.include?(kind)

      targets = Array(params[:targets]).map { |t| t.permit(:course_id, :student_id).to_h.symbolize_keys }
      if targets.empty? || targets.size > BulkIntervention::MAX_TARGETS
        return render json: { errors: ["choose between 1 and #{BulkIntervention::MAX_TARGETS} students"] }, status: :bad_request
      end

      course_ids = targets.pluck(:course_id).uniq
      courses = course_ids.map { |id| scope.course(id) }
      return render_unauthorized_action if courses.any?(&:nil?)
      return render json: { errors: ["interventions are off for this course"] }, status: :forbidden unless courses.all? { |c| Intervener.enabled?(c) }

      content_tag_id = params[:content_tag_id].presence
      if content_tag_id && content_tag_id != "current" && course_ids.size > 1
        return render json: { errors: ["choose students in one class to act on one item"] }, status: :bad_request
      end

      progress = BulkIntervention.start(actor: @current_user,
                                        real_actor: (@real_current_user == @current_user) ? nil : @real_current_user,
                                        kind:,
                                        targets:,
                                        options: { content_tag_id:, reason: params[:reason] }.merge(tool_options).compact)
      render json: progress_json(progress, @current_user, session)
    end

    private

    def scope
      @scope ||= DashboardScope.new(@current_user)
    end

    def load_course_and_student
      @course = scope.course(params[:course_id])
      return render_unauthorized_action unless @course

      @student = @course.student_enrollments.active.where(user_id: params[:student_id]).first&.user
      render json: { message: "student not found" }, status: :not_found unless @student
    end

    def tool_options
      options = params.slice(:attempts, :override_kind, :target_date, :body, :subject, :note_id).permit!.to_h.symbolize_keys
      options[:reset] = value_to_boolean(params[:reset]) if params.key?(:reset)
      options
    end

    # Notes belong to the student, so staff see notes written from any class
    # (in this root account) as long as they can read notes here.
    def notes_json
      StudentNote.active
                 .where(student: @student, root_account_id: @course.root_account_id)
                 .order(created_at: :desc, id: :desc)
                 .preload(:author, :course)
                 .map { |note| note.as_json_for(@current_user) }
    end
  end
end
