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

describe WikiPagesController do
  describe "GET show with the course player" do
    render_views

    let_once(:course) { course_factory(active_all: true) }
    let_once(:student) { student_in_course(course:, active_all: true).user }
    let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
    let_once(:page) { course.wiki_pages.create!(title: "Lesson 1.1", body: "<p>Hi</p>") }
    let_once(:tag) { course.context_modules.create!(name: "Unit 1").add_item(type: "wiki_page", id: page.id) }

    before do
      course.root_account.enable_feature!(:self_paced)
      course.enable_feature!(:self_paced_course_player)
    end

    def show_page
      get :show, params: { course_id: course.id, id: page.url, module_item_id: tag.id }
    end

    it "gives students the player bar instead of the course menu" do
      user_session(student)
      show_page

      # the layout adds this after the main ENV block, so look in the page
      expect(response.body).to include("SELF_PACED_PLAYER_BAR", "\"module_item_id\":\"#{tag.id}\"")
      body_classes = Nokogiri::HTML5(response.body).at_css("body")["class"].split
      expect(body_classes).to include("self-paced-player")
      expect(body_classes).not_to include("with-left-side")
    end

    it "keeps the course menu for teachers" do
      user_session(teacher)
      show_page

      expect(response.body).not_to include("SELF_PACED_PLAYER_BAR")
    end
  end
end
