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

# Alerts for the dashboard (docs/fork-plan.md Phase 6). Staff only see alerts
# for courses in their SelfPaced::DashboardScope that have alerts turned on.
module SelfPaced
  class AlertsController < ApplicationController
    before_action :require_user

    # GET /api/v1/self_paced/alerts[?course_id=]
    def index
      alerts = Alert.currently_open.where(course_id: course_ids).preload(:student, :course, :content_tag)
                    .order(opened_at: :desc, id: :desc)
      render json: { alerts: alerts.map { |alert| alert.as_json_for_api.merge(description: alert.description) } }
    end

    # PUT /api/v1/self_paced/alerts/:id/dismiss
    def dismiss
      alert = Alert.currently_open.where(course_id: course_ids).find_by(id: params[:id])
      return render json: { message: "alert not found" }, status: :not_found unless alert

      alert.dismiss!(@current_user)
      render json: { id: alert.id.to_s, workflow_state: alert.workflow_state }
    end

    # GET /api/v1/courses/:course_id/self_paced/alert_rules
    def rules
      course = alert_course
      return render_unauthorized_action unless course

      render json: rules_json(course)
    end

    # PUT /api/v1/courses/:course_id/self_paced/alert_rules
    #   rules[][kind, threshold, enabled, notify]
    def update_rules
      course = alert_course
      return render_unauthorized_action unless course&.grants_right?(@current_user, :manage_grades)

      changes = Array(params[:rules]).map { |r| r.permit(:kind, :threshold, :enabled, :notify).to_h }
      AlertRule.transaction do
        changes.each do |change|
          rule = AlertRule.find_or_initialize_by(course:, kind: change["kind"].to_s)
          rule.assign_attributes(change.slice("threshold", "enabled", "notify"))
          rule.save!
        end
      end
      render json: rules_json(course)
    rescue ActiveRecord::RecordInvalid => e
      render json: { errors: e.record.errors.full_messages }, status: :unprocessable_content
    end

    private

    def scope
      @scope ||= DashboardScope.new(@current_user)
    end

    def alert_courses
      scope.courses.select { |course| SelfPaced.feature_enabled?(course, :self_paced_alerts) }
    end

    def course_ids
      ids = alert_courses.map(&:id)
      params[:course_id].present? ? ids & [params[:course_id].to_i] : ids
    end

    def alert_course
      alert_courses.find { |course| course.id == params[:course_id].to_i }
    end

    def rules_json(course)
      { rules: AlertRule.effective_for(course).values.map { |r| r.to_h.slice(:kind, :threshold, :enabled, :notify) } }
    end
  end
end
