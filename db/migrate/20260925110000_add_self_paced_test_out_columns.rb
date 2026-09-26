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

# Self-paced Phase 9 (docs/fork-plan.md): test-out by skill. A lesson can say
# which skill (learning outcome) it teaches, and an exemption made because the
# student mastered that skill remembers which skill it was.
class AddSelfPacedTestOutColumns < ActiveRecord::Migration[8.0]
  tag :predeploy
  disable_ddl_transaction!

  def change
    add_reference :module_item_settings, :learning_outcome, foreign_key: true, index: false
    add_index :module_item_settings,
              %i[course_id learning_outcome_id],
              where: "learning_outcome_id IS NOT NULL",
              name: "index_module_item_settings_on_skill",
              algorithm: :concurrently

    add_reference :module_item_student_overrides, :learning_outcome, foreign_key: true, index: false
    add_index :module_item_student_overrides,
              %i[course_id learning_outcome_id],
              where: "learning_outcome_id IS NOT NULL",
              name: "index_module_item_student_overrides_on_skill",
              algorithm: :concurrently
  end
end
