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

describe SelfPaced::DashboardController do
  let_once(:root_account) { Account.create! }
  let_once(:school) { root_account.sub_accounts.create!(name: "North High") }
  let_once(:course) { course_factory(account: school, active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }

  def enable_dashboard
    root_account.enable_feature!(:self_paced)
    root_account.enable_feature!(:self_paced_activity_tracking)
    root_account.enable_feature!(:self_paced_teacher_dashboard)
  end

  describe "GET show" do
    it "renders the dashboard app for a teacher, across all their courses" do
      enable_dashboard
      user_session(teacher)
      get :show

      expect(response).to be_successful
      expect(controller.js_env[:SELF_PACED_DASHBOARD]).to include(roster_url: "/api/v1/self_paced/roster", course_id: nil)
      expect(controller.instance_variable_get(:@body_classes)).to include("full-width")
    end

    it "gives the intervention URLs only when interventions are on" do
      enable_dashboard
      user_session(teacher)
      get :show
      expect(controller.js_env[:SELF_PACED_DASHBOARD]).to include(interventions_url: nil, bulk_interventions_url: nil)

      root_account.enable_feature!(:self_paced_interventions)
      get :show
      expect(controller.js_env[:SELF_PACED_DASHBOARD]).to include(bulk_interventions_url: "/api/v1/self_paced/interventions/bulk")
    end

    it "says which courses have their own page" do
      enable_dashboard
      root_account.enable_feature!(:self_paced_course_view)
      user_session(teacher)
      get :show

      expect(controller.js_env[:SELF_PACED_DASHBOARD]).to include(course_page_ids: [course.id.to_s], course_page_url: "/self_paced/courses/:course_id")
    end

    it "opens filtered to one course when asked" do
      enable_dashboard
      user_session(teacher)
      get :show, params: { course_id: course.id }

      expect(controller.js_env[:SELF_PACED_DASHBOARD]).to include(course_id: course.id.to_s)
    end

    it "ignores a course filter for a course the viewer can't see" do
      enable_dashboard
      user_session(teacher)
      get :show, params: { course_id: course_factory(active_all: true).id }

      expect(controller.js_env[:SELF_PACED_DASHBOARD]).to include(course_id: nil)
    end

    it "opens for a school mentor before any of their students are tracked" do
      enable_dashboard
      mentor = user_factory(active_all: true)
      school.account_users.create!(user: mentor, role: SelfPaced::MentorRole.ensure!(root_account))
      user_session(mentor)
      get :show

      expect(response).to be_successful
    end

    it "is off limits to students" do
      enable_dashboard
      user_session(student)
      get :show

      expect(response).to have_http_status(:unauthorized)
    end

    it "is off limits while the dashboard is off" do
      user_session(teacher)
      get :show

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET course" do
    before do
      enable_dashboard
      root_account.enable_feature!(:self_paced_course_view)
      SelfPaced::StudentCourseState.create!(course:, user: student, root_account:)
    end

    it "renders the course page with links for editing the course" do
      user_session(teacher)
      get :course, params: { course_id: course.id }

      expect(response).to be_successful
      env = controller.js_env[:SELF_PACED_COURSE]
      expect(env[:course][:id]).to eql(course.id.to_s)
      expect(env[:edit_links].pluck(:label)).to include("Modules", "Quizzes")
      expect(controller.js_env[:SELF_PACED_DASHBOARD][:roster_url]).to eql("/api/v1/self_paced/roster?course_id=#{course.id}")
    end

    it "points the page at its alerts only while alerts are on, and lets graders edit the rules" do
      user_session(teacher)
      get :course, params: { course_id: course.id }
      expect(controller.js_env[:SELF_PACED_COURSE]).not_to have_key(:alerts_url)

      root_account.enable_feature!(:self_paced_alerts)
      get :course, params: { course_id: course.id }
      expect(controller.js_env[:SELF_PACED_COURSE]).to include(
        alerts_url: "/api/v1/self_paced/alerts",
        alert_rules_url: "/api/v1/courses/#{course.id}/self_paced/alert_rules",
        can_edit_alert_rules: true
      )
    end

    it "offers the CSV reports only while reports are on" do
      user_session(teacher)
      get :course, params: { course_id: course.id }
      expect(controller.js_env[:SELF_PACED_COURSE]).not_to have_key(:report_links)

      root_account.enable_feature!(:self_paced_reports)
      get :course, params: { course_id: course.id }
      links = controller.js_env[:SELF_PACED_COURSE][:report_links]
      expect(links.pluck(:url)).to include("/api/v1/self_paced/reports/progress?course_id=#{course.id}")
    end

    it "gives a mentor the page without editing links" do
      mentor = user_factory(active_all: true)
      school.account_users.create!(user: mentor, role: SelfPaced::MentorRole.ensure!(root_account))
      user_session(mentor)
      get :course, params: { course_id: course.id }

      expect(controller.js_env[:SELF_PACED_COURSE][:edit_links]).to be_nil
    end

    it "gives a course editor the editing links" do
      editor = user_factory(active_all: true)
      school.account_users.create!(user: editor, role: SelfPaced::CourseEditorRole.ensure!(root_account))
      user_session(editor)
      get :course, params: { course_id: course.id }

      expect(controller.js_env[:SELF_PACED_COURSE][:edit_links].pluck(:label)).to include("Modules")
    end

    it "is off limits while the course page is off" do
      root_account.disable_feature!(:self_paced_course_view)
      user_session(teacher)
      get :course, params: { course_id: course.id }

      expect(response).to have_http_status(:unauthorized)
    end

    it "is off limits for a course outside the viewer's dashboard" do
      user_session(teacher)
      get :course, params: { course_id: course_factory(active_all: true).id }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
