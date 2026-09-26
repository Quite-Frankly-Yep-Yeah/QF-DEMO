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

# The teacher and mentor dashboard page (docs/fork-plan.md feature C), reached
# from "Students" in the global navigation, and the page for one course
# (Phase 5b). Both are the React app in ui/features/self_paced_dashboard,
# reading SelfPaced::DashboardApiController.
#
# /self_paced/dashboard?course_id=4 opens the dashboard filtered to one
# course; ?student_id=7 opens that student's panel.
module SelfPaced
  class DashboardController < ApplicationController
    before_action :require_user

    # GET /self_paced/dashboard
    def show
      scope = DashboardScope.new(@current_user)
      return render_unauthorized_action unless scope.allowed?

      @page_title = t("Students")
      render_app(SELF_PACED_DASHBOARD: dashboard_env(scope).merge(course_id: scope.course(params[:course_id])&.id&.to_s))
    end

    # GET /self_paced/courses/:course_id
    def course
      scope = DashboardScope.new(@current_user)
      course = scope.course(params[:course_id])
      return render_unauthorized_action unless course && scope.course_page?(course)

      @page_title = course.name
      render_app(SELF_PACED_DASHBOARD: dashboard_env(scope).merge(course_id: course.id.to_s,
                                                                  roster_url: api_v1_self_paced_roster_path(course_id: course.id)),
                 SELF_PACED_COURSE: {
                   course: { id: course.id.to_s, name: course.name, course_code: course.course_code },
                   summary_url: api_v1_self_paced_course_summary_path(course_id: course.id),
                   dashboard_url: self_paced_dashboard_path(course_id: course.id),
                   edit_links: edit_links(course)
                 }.merge(alert_links(course), report_links(course)))
    end

    private

    def render_app(env)
      # use the whole window for the roster, not the usual 1366px column
      add_body_class("full-width")
      js_env(env)
      js_bundle :self_paced_dashboard
      render html: '<div id="self_paced_dashboard"></div>'.html_safe, layout: true
    end

    def dashboard_env(scope)
      # the intervention tools show up when any of the viewer's courses has them
      interventions = scope.courses.any? { |course| Intervener.enabled?(course) }
      {
        interventions_url: interventions ? "/api/v1/self_paced/courses/:course_id/students/:student_id/interventions" : nil,
        bulk_interventions_url: interventions ? api_v1_self_paced_bulk_interventions_path : nil,
        roster_url: api_v1_self_paced_roster_path,
        # templates; the app fills in the ids
        student_url: "/api/v1/self_paced/courses/:course_id/students/:student_id",
        caseload_url: "/api/v1/self_paced/caseload/:student_id",
        pacing_url: "/api/v1/courses/:course_id/self_paced/pacing?student_id=:student_id",
        student_pacing_url: "/api/v1/courses/:course_id/self_paced/pacing/:student_id",
        # every course on the dashboard, so each page colors them the same way
        course_ids: scope.courses.map { |course| course.id.to_s },
        # the courses with their own page, and where it is
        course_page_url: "/self_paced/courses/:course_id",
        course_page_ids: scope.courses.select { |course| scope.course_page?(course) }.map { |course| course.id.to_s },
        dashboard_url: self_paced_dashboard_path,
        idle_minutes: Roster::DEFAULT_IDLE_MINUTES,
        poll_seconds: 30,
        # a menu on each student to make a parent sign-up code (Phase 8)
        parent_invites: SelfPaced.feature_enabled?(@domain_root_account, :self_paced_observer_view)
      }
    end

    # CSV downloads for the course page (Phase 7); nothing while reports are off.
    def report_links(course)
      return {} unless SelfPaced.feature_enabled?(course, :self_paced_reports)

      labels = {
        "progress" => t("Progress"),
        "time_on_task" => t("Time on task, last 30 days"),
        "pacing" => t("Pacing"),
        "interventions" => t("Intervention log, last 30 days"),
        "engaged_days" => t("Engaged days, last 30 days")
      }
      { report_links: labels.map { |kind, label| { label:, url: api_v1_self_paced_report_path(kind:, course_id: course.id) } } }
    end

    # Where the course page finds its alerts (Phase 6); nothing while they're off.
    def alert_links(course)
      return {} unless SelfPaced.feature_enabled?(course, :self_paced_alerts)

      {
        alerts_url: api_v1_self_paced_alerts_path,
        alert_rules_url: api_v1_course_self_paced_alert_rules_path(course),
        can_edit_alert_rules: course.grants_right?(@current_user, :manage_grades)
      }
    end

    # Where staff who can edit the course go to change it. Nil for staff who
    # can't (mentors).
    def edit_links(course)
      return nil unless course.grants_any_right?(@current_user, *RoleOverride::GRANULAR_MANAGE_COURSE_CONTENT_PERMISSIONS)

      links = []
      links << { label: t("Course Player setup"), url: self_paced_setup_page_path(course) } if Gating.player_course?(course)
      links << { label: t("Modules"), url: course_context_modules_path(course) }
      links << { label: t("Pages"), url: course_wiki_pages_path(course) }
      links << { label: t("Quizzes"), url: course_quizzes_path(course) }
      links << { label: t("Assignments"), url: course_assignments_path(course) }
      links << { label: t("Files"), url: course_files_path(course) }
      links
    end
  end
end
