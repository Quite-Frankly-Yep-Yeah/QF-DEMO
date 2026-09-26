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
describe SelfPaced::CourseTabs do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }

  def menu
    SectionTabHelper::AvailableSectionTabs.new(course, teacher, course.root_account, {}).to_a
  end

  def css_classes
    menu.pluck(:css_class)
  end

  it "leaves an ordinary course's menu alone" do
    expect(css_classes).to include("pages", "modules")
    expect(menu.find { |tab| tab[:css_class] == "modules" }[:label]).to eql("Modules")
  end

  context "in a Course Player course" do
    before do
      course.root_account.enable_feature!(:self_paced)
      course.enable_feature!(:self_paced_course_player)
    end

    it "drops the tabs a self-paced class doesn't use" do
      expect(css_classes & described_class::HIDDEN).to be_empty
    end

    it "calls Modules Units" do
      modules = menu.find { |tab| tab[:css_class] == "modules" }

      expect(modules[:label]).to eql("Units")
      expect(modules[:href]).to eql(:course_context_modules_path)
    end

    it "calls Outcomes Skills" do
      expect(menu.find { |tab| tab[:css_class] == "outcomes" }[:label]).to eql("Skills")
    end

    it "keeps what the class does use" do
      expect(css_classes).to include("home", "grades", "people", "settings")
    end

    it "follows the Course Player being turned off" do
      menu
      course.disable_feature!(:self_paced_course_player)

      expect(css_classes).to include("pages")
    end
  end
end
