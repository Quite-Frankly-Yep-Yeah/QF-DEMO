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
describe "TeacherWorkflow::GradingQueueController" do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:assignment) { course.assignments.create!(title: "A", points_possible: 10, submission_types: "online_text_entry") }

  before do
    assignment.submit_homework(student, submission_type: "online_text_entry", body: "x", submitted_at: 1.day.ago)
    course.root_account.enable_feature!(:teacher_workflow)
    course.account.enable_feature!(:workflow_grading_queue)
  end

  it "returns the queue for a teacher" do
    user_session(teacher)
    get "/api/v1/workflow/grading_queue"
    expect(response).to be_successful
    body = response.parsed_body
    expect(body["rows"].size).to eq 1
    expect(body["tier_counts"]).to eq({ "1" => 0, "2" => 0, "3" => 0, "4" => 1 })
  end

  it "passes the filters through" do
    user_session(teacher)
    get "/api/v1/workflow/grading_queue", params: { student_id: 0 }
    expect(response.parsed_body["rows"]).to eq []
  end

  it "is empty for a student" do
    user_session(student)
    get "/api/v1/workflow/grading_queue"
    expect(response.parsed_body["rows"]).to eq []
  end

  it "needs a signed-in user" do
    get "/api/v1/workflow/grading_queue"
    expect(response).to have_http_status(:unauthorized)
  end

  it "is a 404 while the flag is off" do
    course.root_account.disable_feature!(:teacher_workflow)
    user_session(teacher)
    get "/api/v1/workflow/grading_queue"
    expect(response).to have_http_status(:not_found)
  end

  it "serves the page to a teacher" do
    user_session(teacher)
    get "/workflow/grading"
    expect(response).to be_successful
    expect(response.body).to include('id="workflow_grading_queue"')
  end

  it "is a 404 while only the umbrella flag is on" do
    course.account.disable_feature!(:workflow_grading_queue)
    user_session(teacher)
    get "/api/v1/workflow/grading_queue"
    expect(response).to have_http_status(:not_found)
    get "/workflow/grading"
    expect(response).to have_http_status(:not_found)
  end
end
