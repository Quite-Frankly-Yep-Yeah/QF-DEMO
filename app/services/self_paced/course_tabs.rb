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

# The course menu of a Course Player course (docs/fork-plan.md): only what a
# self-paced class uses, with "Modules" called "Units". Everything else stays
# in the course, it just isn't in the menu; add a name to HIDDEN or remove one
# to change what shows.
module SelfPaced
  module CourseTabs
    # Tab css classes (Course#tabs_available) left out of the menu.
    HIDDEN = %w[
      pages
      ai_experiences
      syllabus
      conferences
      collaborations
      notebook
      groups
      schedule
      youtube_migration
      quizzes
      rubrics
      assignments
      files
      discussions
      announcements
    ].freeze

    # Tabs shown under a friendlier name.
    RENAMED = {
      "modules" => -> { I18n.t("Units") },
      "outcomes" => -> { I18n.t("Skills") }
    }.freeze

    def self.apply(tabs, course)
      return tabs unless Gating.player_course?(course)

      tabs.filter_map do |tab|
        css_class = tab[:css_class].to_s
        next if HIDDEN.include?(css_class)

        RENAMED.key?(css_class) ? tab.merge(label: RENAMED[css_class].call) : tab
      end
    end
  end
end
