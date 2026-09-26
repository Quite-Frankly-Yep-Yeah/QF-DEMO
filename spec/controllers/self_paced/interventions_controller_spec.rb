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

describe SelfPaced::InterventionsController do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:classmate) { student_in_course(course:, active_all: true, name: "Jordan Kim").user }
  let_once(:page_tag) do
    course.context_modules.create!(name: "Unit 1").add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson 1.1").id)
  end
  let_once(:outsider_course) { course_factory(active_all: true) }
  let_once(:outsider) { student_in_course(course: outsider_course, active_all: true).user }

  before do
    %i[self_paced self_paced_activity_tracking self_paced_teacher_dashboard self_paced_interventions].each do |flag|
      course.root_account.enable_feature!(flag)
    end
    course.enable_feature!(:self_paced_course_player)
    [student, classmate].each do |user|
      SelfPaced::StudentCourseState.create!(course:, user:, root_account: course.root_account, current_content_tag: page_tag)
    end
  end

  describe "GET index" do
    it "returns the viewer's tools, the log and the notes" do
      SelfPaced::Intervener.new(course, teacher).perform("note", student:, body: "Doing well")
      user_session(teacher)
      get :index, params: { course_id: course.id, student_id: student.id }, format: :json

      json = response.parsed_body
      expect(json["tools"]).to include("unlock" => true, "note" => true)
      expect(json["log"].pluck("kind")).to eql(["note"])
      expect(json["notes"].map { |n| [n["body"], n["can_delete"]] }).to eql([["Doing well", true]])
    end

    it "refuses a course outside the viewer's dashboard" do
      user_session(teacher)
      get :index, params: { course_id: outsider_course.id, student_id: outsider.id }, format: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST create" do
    it "unlocks an item" do
      user_session(teacher)
      post :create, params: { course_id: course.id, student_id: student.id, kind: "unlock", content_tag_id: page_tag.id, reason: "Absent" }, format: :json

      expect(response).to be_successful
      expect(response.parsed_body.dig("intervention", "item", "title")).to eql("Lesson 1.1")
      expect(SelfPaced::ItemOverride.active.where(user: student, kind: "unlock")).to exist
    end

    it "explains a request that doesn't make sense" do
      user_session(teacher)
      post :create, params: { course_id: course.id, student_id: student.id, kind: "undo", content_tag_id: page_tag.id, override_kind: "exempt" }, format: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first).to match(/no exempt to undo/)
    end

    it "returns the notes after adding one" do
      user_session(teacher)
      post :create, params: { course_id: course.id, student_id: student.id, kind: "note", body: "Called home" }, format: :json

      expect(response.parsed_body["notes"].pluck("body")).to eql(["Called home"])
    end

    it "is forbidden to a student" do
      user_session(classmate)
      post :create, params: { course_id: course.id, student_id: student.id, kind: "note", body: "hi" }, format: :json

      expect(response).to have_http_status(:forbidden)
      expect(SelfPaced::StudentNote.count).to be 0
    end
  end

  describe "POST bulk" do
    it "runs the action for each student in a job and reports the result" do
      user_session(teacher)
      post :bulk,
           params: { kind: "unlock",
                     content_tag_id: "current",
                     targets: [{ course_id: course.id, student_id: student.id }, { course_id: course.id, student_id: classmate.id }] },
           format: :json

      progress = Progress.find(response.parsed_body["id"])
      run_jobs
      expect(progress.reload.results).to eql("done" => 2, "failed" => [])
      expect(SelfPaced::Intervention.where(progress:).pluck(:student_id)).to match_array([student.id, classmate.id])
    end

    it "lists the students it couldn't act on" do
      user_session(teacher)
      post :bulk,
           params: { kind: "undo", content_tag_id: "current", override_kind: "unlock", targets: [{ course_id: course.id, student_id: student.id }] },
           format: :json

      expect(response).to have_http_status(:bad_request)

      post :bulk,
           params: { kind: "reset_attempt", content_tag_id: "current", targets: [{ course_id: course.id, student_id: student.id }] },
           format: :json
      progress = Progress.find(response.parsed_body["id"])
      run_jobs
      expect(progress.reload.results["failed"].map { |f| f.slice("student_id", "name") }).to eql([{ "student_id" => student.id.to_s, "name" => "Maya Lopez" }])
    end

    it "refuses students in courses outside the viewer's dashboard" do
      user_session(teacher)
      post :bulk, params: { kind: "note", body: "hi", targets: [{ course_id: outsider_course.id, student_id: outsider.id }] }, format: :json

      expect(response).to have_http_status(:forbidden)
    end
  end
end
