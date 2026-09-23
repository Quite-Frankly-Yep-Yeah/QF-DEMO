# frozen_string_literal: true

#
# Copyright (C) 2026 - present EXAMPLE contributors
#
# This file is part of EXAMPLE LMS, a modified version of Canvas.
#
# EXAMPLE LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

describe SelfPaced::ContentTagResolver do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:context_module) { course.context_modules.create!(name: "Unit 1") }
  let_once(:page) { course.wiki_pages.create!(title: "Linear Equations") }
  let_once(:page_tag) { context_module.add_item(type: "wiki_page", id: page.id) }
  let_once(:assignment) { course.assignments.create!(title: "Check 1") }
  let_once(:assignment_tag) { context_module.add_item(type: "assignment", id: assignment.id) }

  describe ".resolve" do
    it "uses the module item id when there is one" do
      expect(described_class.resolve(course, module_item_id: assignment_tag.id.to_s, path: "/courses/#{course.id}/pages/#{page.url}"))
        .to eql(assignment_tag)
    end

    it "ignores a module item id from another course and falls back to the path" do
      other_course = course_factory(active_all: true)
      other_tag = other_course.context_modules.create!(name: "Other")
                              .add_item(type: "wiki_page", id: other_course.wiki_pages.create!(title: "Other").id)

      expect(described_class.resolve(course, module_item_id: other_tag.id, path: "/courses/#{course.id}/pages/#{page.url}"))
        .to eql(page_tag)
    end

    it "finds a page's module item from its path" do
      expect(described_class.resolve(course, path: "/courses/#{course.id}/pages/#{page.url}")).to eql(page_tag)
    end

    it "finds an assignment's module item from its path" do
      expect(described_class.resolve(course, path: "/courses/#{course.id}/assignments/#{assignment.id}/submissions"))
        .to eql(assignment_tag)
    end

    it "returns nil for pages that aren't module items" do
      expect(described_class.resolve(course, path: "/courses/#{course.id}/grades")).to be_nil
    end

    it "returns nil for another course's path" do
      expect(described_class.resolve(course, path: "/courses/#{course.id + 1}/pages/#{page.url}")).to be_nil
    end
  end
end
