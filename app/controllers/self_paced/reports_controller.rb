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

# CSV exports of the self-paced reports (docs/fork-plan.md Phase 7) for the
# courses in the viewer's SelfPaced::DashboardScope. The same reports are
# available to admins through Account Reports.
module SelfPaced
  class ReportsController < ApplicationController
    before_action :require_user

    DEFAULT_DAYS = 30

    # GET /api/v1/self_paced/reports/:kind[?course_id=&from=&to=]  (CSV)
    def show
      return render json: { message: "unknown report" }, status: :not_found unless Reports.valid_kind?(params[:kind])

      courses = report_courses
      return render_unauthorized_action if courses.empty?

      from, to = date_range
      return render json: { errors: ["from must be on or before to"] }, status: :bad_request if from > to

      grades = lambda do |course|
        if scope.unposted_grades_visible?(course)
          :unposted
        elsif scope.grades_visible?(course)
          :posted
        end
      end
      csv = Reports.new(courses, from:, to:, grades:).to_csv(params[:kind])
      send_data csv, type: "text/csv", disposition: "attachment", filename: "self_paced_#{params[:kind]}_#{to.iso8601}.csv"
    end

    private

    def scope
      @scope ||= DashboardScope.new(@current_user)
    end

    def report_courses
      courses = scope.courses.select { |course| SelfPaced.feature_enabled?(course, :self_paced_reports) }
      params[:course_id].present? ? courses.select { |course| course.id == params[:course_id].to_i } : courses
    end

    def date_range
      to = parse_date(params[:to]) || Time.zone.today
      from = parse_date(params[:from]) || (to - (DEFAULT_DAYS - 1).days)
      [from, to]
    end

    def parse_date(value)
      Date.iso8601(value.to_s) if value.present?
    rescue ArgumentError
      nil
    end
  end
end
