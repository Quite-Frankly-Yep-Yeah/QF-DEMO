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
require_relative "messages_helper"

describe "self_paced_alert" do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let(:asset) do
    SelfPaced::Alert.create!(course:, student:, kind: "behind", detail: { "days_behind" => 4 }, opened_at: Time.zone.now)
  end
  let(:notification_name) { :self_paced_alert }

  it_behaves_like "a message"

  it "names the student, says what is wrong and links to their panel" do
    email = generate_message(:self_paced_alert, :email, asset)

    expect(email.subject).to include("Maya Lopez", course.name)
    expect(email.body).to include("4 days behind their pace")
    expect(email.body).to include("/self_paced/dashboard?course_id=#{course.id}&student_id=#{student.id}")
  end
end
