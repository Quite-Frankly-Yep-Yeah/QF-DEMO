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

describe SelfPaced::Estimator do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:unit) { course.context_modules.create!(name: "Unit 1") }

  def page_tag(words)
    unit.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Page", body: "<p>#{Array.new(words, "word").join(" ")}</p>").id)
  end

  describe ".minutes" do
    it "uses the teacher's estimate" do
      expect(described_class.minutes(page_tag(10), SelfPaced::ItemSetting.new(estimated_minutes: 12))).to be(12)
    end

    it "gives items with no role no time" do
      expect(described_class.minutes(page_tag(1500), SelfPaced::ItemSetting.new(role: "none"))).to be(0)
    end

    it "estimates reading time for pages, with a floor" do
      expect(described_class.minutes(page_tag(1500))).to be(12)
      expect(described_class.minutes(page_tag(30))).to be(5)
    end

    it "allows a few minutes per quiz question" do
      quiz = course.quizzes.create!(title: "Check")
      quiz.update_column(:question_count, 10)

      expect(described_class.minutes(unit.add_item(type: "quiz", id: quiz.id))).to be(30)
    end

    it "uses flat defaults for other items" do
      assignment = course.assignments.create!(title: "Practice")

      expect(described_class.minutes(unit.add_item(type: "assignment", id: assignment.id))).to be(30)
    end
  end
end
