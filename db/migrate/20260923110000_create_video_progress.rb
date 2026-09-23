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

# Self-paced Phase 3 (docs/fork-plan.md §2.9, docs/spikes/video-tracking.md):
# how much of a module item's video each student has actually watched.
class CreateVideoProgress < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :video_progress do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.references :content_tag, null: false, foreign_key: true, index: false
      t.references :course, null: false, foreign_key: true, index: true
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.float :max_fraction, null: false, default: 0
      t.float :duration_seconds
      t.timestamp :first_reported_at, null: false
      t.timestamp :completed_at
      t.timestamps

      t.check_constraint "max_fraction BETWEEN 0 AND 1", name: "chk_video_progress_fraction"
      t.index %i[user_id content_tag_id], unique: true
      t.replica_identity_index
    end
  end
end
