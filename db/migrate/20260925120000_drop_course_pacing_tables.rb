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

# Phase 10 (docs/fork-plan.md): Canvas's Course Pacing is gone, replaced by the
# self-paced engine. Its tables, and the course reports that only ever made the
# pacing document, go with it.
class DropCoursePacingTables < ActiveRecord::Migration[8.0]
  tag :postdeploy

  def up
    drop_table :course_pace_module_items
    drop_table :course_paces
    drop_table :course_reports
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
