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

describe Supports::StudentsController do
  let_once(:root_account) { Account.default }
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:plan) { Supports::Plan.create!(account: root_account, student:, plan_type: "iep") }

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
    Supports::Catalog.ensure_defaults!(root_account)
    plan.accommodations.create!(accommodation_type: Supports::AccommodationType.find_by(kind: "extended_time"),
                                parameters: { minutes: 30 })
  end

  describe "GET 'accommodations'" do
    it "shows the student's teacher the accommodations" do
      user_session(teacher)
      get "accommodations", params: { student_id: student.id }, format: :json
      expect(response).to be_successful
      expect(json_parse(response.body)["accommodations"].first["details"]).to eql "30 extra minutes on timed quizzes"
    end

    it "refuses the student" do
      user_session(student)
      get "accommodations", params: { student_id: student.id }, format: :json
      expect(response).not_to be_successful
    end

    it "refuses everyone while the plans flag is off" do
      root_account.disable_feature!(:supports_plans)
      user_session(teacher)
      get "accommodations", params: { student_id: student.id }, format: :json
      expect(response).not_to be_successful
    end
  end

  describe "GET 'applications'" do
    let(:admin) { account_admin_user(account: root_account) }

    before do
      accommodation = plan.accommodations.first
      Supports::Application.record!(accommodation, kind: "display", context: student, details: { setting: "high_contrast" })
      old = Supports::Application.record!(accommodation, kind: "pacing", context: student)
      Supports::Application.where(id: old.id).update_all(created_at: 2.weeks.ago)
    end

    it "shows an admin what was applied this week" do
      user_session(admin)
      get "applications", params: { student_id: student.id }, format: :json
      rows = json_parse(response.body)["applications"]
      expect(rows.pluck("kind")).to eql ["display"]
      expect(rows.first["accommodation"]).to eql "Extended time on tests and quizzes"
    end

    it "logs the read" do
      user_session(admin)
      get "applications", params: { student_id: student.id }, format: :json
      expect(Supports::AccessLog.where(viewer: admin, subject: "applications").count).to be 1
    end

    it "refuses a teacher" do
      user_session(teacher)
      get "applications", params: { student_id: student.id }, format: :json
      expect(response).not_to be_successful
    end
  end

  describe "GET 'show'" do
    it "refuses a teacher, who can't see plan details" do
      user_session(teacher)
      get "show", params: { student_id: student.id }, format: :json
      expect(response).not_to be_successful
    end

    it "shows an account admin the plan" do
      user_session(account_admin_user(account: root_account))
      get "show", params: { student_id: student.id }, format: :json
      expect(json_parse(response.body)["plans"].first["plan_type"]).to eql "iep"
    end
  end

  describe "POST 'acknowledge'" do
    it "records the teacher's acknowledgement" do
      user_session(teacher)
      post "acknowledge", params: { student_id: student.id }, format: :json
      expect(json_parse(response.body)["acknowledged"]).to be true
    end
  end

  describe "GET 'search'" do
    let_once(:admin) { account_admin_user(account: root_account, name: "Ada Admin") }

    def login_for(user, unique_id:, sis_user_id: nil, account: root_account)
      user.pseudonyms.create!(unique_id:, sis_user_id:, account:)
      user
    end

    def found(term)
      get "search", params: { search_term: term }, format: :json
      json_parse(response.body)["students"]
    end

    before { user_session(admin) }

    it "still finds an enrolled student by name" do
      student.update!(name: "Pat Enrolled")
      expect(found("Enrolled").pluck("name")).to eq ["Pat Enrolled"]
    end

    it "finds a new student who has a login but no enrollment yet" do
      newbie = login_for(user_factory(active_all: true, name: "Nicholas Harris"), unique_id: "ncharri448@example.com", sis_user_id: "20094448")
      expect(found("Nicholas").pluck("id")).to eq [newbie.id.to_s]
    end

    it "finds a student by SIS user ID or login ID, from the start of either" do
      newbie = login_for(user_factory(active_all: true, name: "Nicholas Harris"), unique_id: "ncharri448@example.com", sis_user_id: "20094448")
      expect(found("20094448").pluck("id")).to eq [newbie.id.to_s]
      expect(found("2009").pluck("id")).to eq [newbie.id.to_s]
      expect(found("NCHARRI").pluck("id")).to eq [newbie.id.to_s]
      expect(found("harri448")).to eq []
    end

    it "finds an enrolled student by their SIS ID too" do
      login_for(student, unique_id: "pat@example.com", sis_user_id: "S-555")
      expect(found("S-55").pluck("id")).to eq [student.id.to_s]
    end

    it "shows the SIS user ID so two people with the same name can be told apart" do
      login_for(user_factory(active_all: true, name: "Sam Same"), unique_id: "sam1@example.com", sis_user_id: "111111")
      login_for(user_factory(active_all: true, name: "Sam Same"), unique_id: "sam2@example.com", sis_user_id: "222222")
      expect(found("Sam Same").pluck("sis_user_id")).to match_array %w[111111 222222]
    end

    it "doesn't offer staff just because they have a login" do
      login_for(teacher, unique_id: "teach@example.com", sis_user_id: "T-1")
      ta = login_for(user_factory(active_all: true, name: "Tia Assistant"), unique_id: "tia@example.com")
      course.enroll_ta(ta, enrollment_state: "active")
      expect(found("T-1")).to eq []
      expect(found("Tia")).to eq []
      expect(found("Ada Admin")).to eq []
    end

    it "doesn't find someone with a login only at another school, or no login and no enrollment" do
      other_root = Account.create!(name: "Elsewhere")
      login_for(user_factory(active_all: true, name: "Olive Elsewhere"), unique_id: "olive@example.com", sis_user_id: "9999", account: other_root)
      user_factory(active_all: true, name: "Nora Nologin")
      expect(found("Olive")).to eq []
      expect(found("9999")).to eq []
      expect(found("Nora")).to eq []
    end

    it "doesn't find someone whose login was deleted" do
      gone = login_for(user_factory(active_all: true, name: "Gail Gone"), unique_id: "gail@example.com", sis_user_id: "4444")
      gone.pseudonyms.each(&:destroy)
      expect(found("4444")).to eq []
    end

    it "needs two characters and keeps its limit" do
      expect(found("a")).to eq []
      22.times { |i| login_for(user_factory(active_all: true, name: "Many Student #{i}"), unique_id: "many#{i}@example.com") }
      expect(found("Many Student").size).to eq 20
    end

    it "is refused to someone who can't manage every student's plans" do
      user_session(teacher)
      get "search", params: { search_term: "Pat" }, format: :json
      expect(response).not_to be_successful
    end

    it "lets a case manager search their own caseload, and nobody else's" do
      role = custom_account_role("Case manager", account: root_account)
      root_account.role_overrides.create!(permission: "supports_manage_plans", role:, enabled: true)
      manager = user_factory(active_all: true)
      root_account.account_users.create!(user: manager, role:)
      mine = login_for(user_factory(active_all: true, name: "Casey Caseload"), unique_id: "casey@example.com")
      login_for(user_factory(active_all: true, name: "Casey Notmine"), unique_id: "notmine@example.com")
      Supports::Caseload.create!(root_account:, staff_id: manager.id, student_id: mine.id)
      user_session(manager)
      expect(found("Casey").pluck("id")).to eq [mine.id.to_s]
    end

    it "still refuses a case manager with no caseload" do
      role = custom_account_role("Case manager", account: root_account)
      root_account.role_overrides.create!(permission: "supports_manage_plans", role:, enabled: true)
      manager = user_factory(active_all: true)
      root_account.account_users.create!(user: manager, role:)
      user_session(manager)
      get "search", params: { search_term: "Pat" }, format: :json
      expect(response).not_to be_successful
    end
  end
end
