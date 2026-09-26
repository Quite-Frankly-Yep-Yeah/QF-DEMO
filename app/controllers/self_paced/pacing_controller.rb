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

# Pacing API (docs/fork-plan.md §2.3):
# - students read their own plan;
# - dashboard staff read any of their students' plans, and change a student's
#   target date with self_paced_adjust_pacing;
# - course designers read the school calendar and set the course's target
#   date; account admins also edit the weekly calendar.
module SelfPaced
  class PacingController < ApplicationController
    before_action :require_user
    before_action :require_context
    before_action :require_pacing_course

    # GET /api/v1/courses/:course_id/self_paced/pacing[?student_id=]
    def show
      student = if params[:student_id].blank? || params[:student_id].to_s == @current_user.id.to_s
                  @current_user
                else
                  return render_unauthorized_action unless @context.grants_right?(@current_user, :self_paced_view_dashboard)

                  User.find_by(id: params[:student_id])
                end
      pacer = Pacer.new(@context, student) if student
      return render json: { message: "not a student in this course" }, status: :not_found unless pacer&.refresh!

      can_adjust = student != @current_user && @context.grants_right?(@current_user, :self_paced_adjust_pacing)
      render json: pacer.as_json(can_adjust:)
    end

    # PUT /api/v1/courses/:course_id/self_paced/pacing/:student_id
    #   target_date=YYYY-MM-DD, or reset=true to follow the course's end date,
    #   and an optional reason. Logged as an "adjust_target" intervention.
    def update
      return render_unauthorized_action unless @context.grants_right?(@current_user, :self_paced_adjust_pacing)

      student = @context.student_enrollments.active.where(user_id: params[:student_id]).first&.user
      return render json: { message: "not a student in this course" }, status: :not_found unless student

      begin
        Intervener.new(@context, @current_user, real_actor: @real_current_user)
                  .perform("adjust_target",
                           student:,
                           reason: params[:reason],
                           target_date: params[:target_date],
                           reset: value_to_boolean(params[:reset]))
      rescue Intervener::Invalid => e
        return render json: { errors: [e.message] }, status: :bad_request
      end
      render json: Pacer.new(@context, student).as_json(can_adjust: true)
    end

    # GET /api/v1/courses/:course_id/self_paced/calendar
    def calendar
      return unless authorized_action(@context, @current_user, RoleOverride::GRANULAR_MANAGE_COURSE_CONTENT_PERMISSIONS)

      render json: calendar_json
    end

    # PUT /api/v1/courses/:course_id/self_paced/calendar
    #   target_date (course designers), weekday_minutes[] and date_minutes{} (account admins)
    def update_calendar
      return unless authorized_action(@context, @current_user, RoleOverride::GRANULAR_MANAGE_COURSE_CONTENT_PERMISSIONS)

      if params.key?(:target_date)
        date = params[:target_date].presence && parse_date(params[:target_date])
        return render json: { errors: ["target_date must be a date (YYYY-MM-DD)"] }, status: :bad_request if params[:target_date].present? && !date

        @context.self_paced_target_date = date&.iso8601
        @context.save!
        Pacer.replan_course_later(@context)
      end

      if params.key?(:weekday_minutes) || params.key?(:date_minutes)
        return render_unauthorized_action unless calendar_editable?

        record = InstructionalCalendar.find_or_initialize_by(account: @context.account)
        if record.new_record? && (inherited = InstructionalCalendar.for_account(@context.account))
          record.assign_attributes(inherited.attributes.slice("weekday_minutes", "date_minutes"))
        end
        record.weekday_minutes = Array(params[:weekday_minutes]).map { |m| Integer(m, exception: false) } if params.key?(:weekday_minutes)
        record.date_minutes = date_minutes_param if params.key?(:date_minutes)
        return render json: { errors: record.errors.full_messages }, status: :unprocessable_content unless record.save
      end

      render json: calendar_json
    end

    private

    def require_pacing_course
      render_unauthorized_action unless Pacer.course?(@context)
    end

    def calendar_editable?
      @context.account.grants_right?(@current_user, :manage_account_settings)
    end

    def parse_date(value)
      Date.iso8601(value.to_s)
    rescue Date::Error
      nil
    end

    def date_minutes_param
      raw = params[:date_minutes]
      raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
      return {} unless raw.is_a?(Hash)

      raw.to_h { |date, minutes| [date.to_s, Integer(minutes.to_s, exception: false)] }
    end

    def calendar_json
      school = SchoolCalendar.new(@context)
      record = InstructionalCalendar.for_account(@context.account)
      {
        account: { id: @context.account.id.to_s, name: @context.account.name },
        calendar_account_id: record&.account_id&.to_s,
        weekday_minutes: school.weekday_minutes,
        date_minutes: record&.date_minutes || {},
        can_edit_calendar: calendar_editable?,
        target_date: @context.self_paced_target_date.presence,
        course_end_date: (@context.conclude_at || @context.enrollment_term&.end_at)&.in_time_zone(@context.time_zone)&.to_date&.iso8601,
        blackout_dates: school.blackout_records.map { |record| blackout_json(record) }.sort_by { |b| b[:start_date] },
        blackout_dates_url: "/api/v1/courses/#{@context.id}/blackout_dates"
      }
    end

    def blackout_json(record)
      if record.is_a?(CalendarEvent)
        zone = @context.time_zone
        { id: nil,
          title: record.title,
          start_date: record.start_at.in_time_zone(zone).to_date.iso8601,
          end_date: record.end_at.in_time_zone(zone).to_date.iso8601,
          source: "calendar" }
      else
        { id: (record.context_type == "Course") ? record.id.to_s : nil,
          title: record.event_title,
          start_date: record.start_date.iso8601,
          end_date: record.end_date.iso8601,
          source: (record.context_type == "Course") ? "course" : "account" }
      end
    end
  end
end
