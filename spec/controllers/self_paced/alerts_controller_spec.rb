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
describe SelfPaced::AlertsController do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:outsider_course) { course_factory(active_all: true) }
  let_once(:outsider) { student_in_course(course: outsider_course, active_all: true).user }

  before do
    %i[self_paced self_paced_activity_tracking self_paced_teacher_dashboard self_paced_alerts].each do |flag|
      course.root_account.enable_feature!(flag)
    end
    [[course, student], [outsider_course, outsider]].each do |c, s|
      SelfPaced::StudentCourseState.create!(course: c, user: s, root_account: c.root_account)
    end
  end

  def open_alert(alert_course, alert_student, kind = "behind")
    SelfPaced::Alert.create!(course: alert_course, student: alert_student, kind:, detail: { "days_behind" => 4 }, opened_at: Time.zone.now)
  end

  describe "GET index" do
    it "lists the open alerts in the viewer's courses, with a sentence for each" do
      open_alert(course, student)
      open_alert(outsider_course, outsider)
      user_session(teacher)
      get :index, format: :json

      alerts = response.parsed_body["alerts"]
      expect(alerts.map { |a| [a.dig("student", "name"), a["kind"], a["description"]] })
        .to eql([["Maya Lopez", "behind", "4 days behind their pace"]])
    end

    it "leaves out resolved and dismissed alerts" do
      open_alert(course, student).resolve!
      user_session(teacher)
      get :index, format: :json

      expect(response.parsed_body["alerts"]).to be_empty
    end

    it "shows nothing while the alerts flag is off" do
      open_alert(course, student)
      course.root_account.disable_feature!(:self_paced_alerts)
      user_session(teacher)
      get :index, format: :json

      expect(response.parsed_body["alerts"]).to be_empty
    end
  end

  describe "PUT dismiss" do
    it "dismisses the alert and remembers who did" do
      alert = open_alert(course, student)
      user_session(teacher)
      put :dismiss, params: { id: alert.id }, format: :json

      expect(alert.reload).to have_attributes(workflow_state: "dismissed", dismissed_by: teacher)
    end

    it "can't dismiss another school's alert" do
      alert = open_alert(outsider_course, outsider)
      user_session(teacher)
      put :dismiss, params: { id: alert.id }, format: :json

      expect(response).to have_http_status(:not_found)
      expect(alert.reload).to be_open
    end
  end

  describe "rules" do
    it "shows the effective rules, defaults included" do
      user_session(teacher)
      get :rules, params: { course_id: course.id }, format: :json

      rules = response.parsed_body["rules"].index_by { |r| r["kind"] }
      expect(rules.keys).to match_array(SelfPaced::AlertRule::KINDS)
      expect(rules["behind"]).to include("threshold" => 3, "enabled" => true)
      expect(rules["low_grade"]).to include("enabled" => false)
    end

    it "saves a course's rules" do
      user_session(teacher)
      put :update_rules, params: { course_id: course.id, rules: [{ kind: "behind", threshold: 5, enabled: true, notify: false }] }, format: :json

      expect(response).to be_successful
      expect(SelfPaced::AlertRule.effective_for(course)["behind"]).to have_attributes(threshold: 5, notify: false)
    end

    it "rejects a bad threshold" do
      user_session(teacher)
      put :update_rules, params: { course_id: course.id, rules: [{ kind: "low_grade", threshold: 150 }] }, format: :json

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "only lets people who can grade change them" do
      user_session(student)
      put :update_rules, params: { course_id: course.id, rules: [{ kind: "behind", threshold: 5 }] }, format: :json

      expect(response).to have_http_status(:forbidden)
    end
  end
end
