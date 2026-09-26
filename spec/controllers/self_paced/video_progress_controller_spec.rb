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

describe SelfPaced::VideoProgressController do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:video_tag) do
    course.context_modules.create!(name: "Unit 1").add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Video").id)
  end

  before do
    course.root_account.enable_feature!(:self_paced)
    course.enable_feature!(:self_paced_course_player)
    SelfPaced::ItemSetting.create!(content_tag: video_tag, course:, role: "instruction", watch_fraction: 0.9)
  end

  describe "POST create" do
    def report(fraction: 0.05)
      post :create, params: { course_id: course.id, module_item_id: video_tag.id, fraction:, duration: 600 }, format: :json
    end

    it "records a student's progress" do
      user_session(student)
      report

      expect(response.parsed_body).to include("max_fraction" => 0.05, "completed" => false)
    end

    it "ignores teachers" do
      user_session(teacher)
      report

      expect(response).to have_http_status(:no_content)
      expect(SelfPaced::VideoProgress.where(content_tag: video_tag)).not_to exist
    end

    it "says not found for an item from another course" do
      user_session(student)
      post :create, params: { course_id: course.id, module_item_id: 0, fraction: 0.5, duration: 600 }, format: :json

      expect(response).to have_http_status(:not_found)
    end
  end
end
