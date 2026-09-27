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

# The school's accommodation catalog (docs/teacher-workflow-plan.md §2.3). A
# root account starts with a common list that the school can edit.
module Supports
  module Catalog
    DEFAULTS = [
      ["Extended time on tests and quizzes", "extended_time", { multiplier: 1.5 },
       "Timed quizzes give this student more time automatically once applying accommodations is turned on."],
      ["Extended deadlines", "extended_deadlines", { percent: 25, mode: "extend_finish" },
       "The student's pacing plan and due dates allow more time."],
      ["Extra quiz attempts", "extra_attempts", { attempts: 1 },
       "Allow the student another try on quizzes."],
      ["Reduced workload", "reduced_workload", {},
       "Choose which items the student may skip, keeping the ones that show mastery."],
      ["Frequent check-ins", "check_ins", { every_days: 7 },
       "Check in with the student regularly about their progress."],
      ["High contrast display", "display", { setting: "high_contrast" },
       "The student's display uses high contrast. They can change it."],
      ["Dyslexia-friendly font", "display", { setting: "use_dyslexic_font" },
       "The student's display uses a dyslexia-friendly font. They can change it."],
      ["Read aloud", "informational", {},
       "Directions and questions may be read aloud, or the student may use text to speech."],
      ["Chunked directions", "informational", {},
       "Break directions and longer tasks into smaller steps."],
      ["Calculator", "informational", {},
       "The student may use a calculator except where the skill being tested is computation."],
      ["Word bank", "informational", {},
       "Give a word bank for fill-in and short-answer questions."],
      ["Breaks as needed", "informational", {},
       "The student may take short breaks during longer work."],
      ["Speech to text or scribe", "informational", {},
       "The student may dictate written answers."],
      ["Alternate format materials", "informational", {},
       "Provide materials in the format in the student's plan, for example large print or audio."]
    ].freeze

    # Creates the default list for +root_account+ the first time it is needed.
    def self.ensure_defaults!(root_account)
      return if AccommodationType.where(root_account:).exists?

      DEFAULTS.each_with_index do |(name, kind, params, instructions), position|
        AccommodationType.create!(root_account:, name:, kind:, default_parameters: params, instructions:, position:)
      end
    end

    def self.types(root_account)
      ensure_defaults!(root_account)
      AccommodationType.active.where(root_account:)
    end
  end
end
