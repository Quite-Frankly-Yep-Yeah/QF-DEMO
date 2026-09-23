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

# Retention and user merges for self-paced data (docs/fork-plan.md §4,
# decision 5): a student's rows are kept until their user is deleted, and move
# with them when two users are merged.
module SelfPaced
  module UserData
    class << self
      def purge_later(user)
        delay(priority: Delayed::LOW_PRIORITY).purge(user.id)
      end

      def purge(user_id)
        user = User.find_by(id: user_id)
        return unless user

        Shard.with_each_shard(user.associated_shards) do
          [ActivityDay, ItemTime, StudentCourseState, VideoProgress, ItemOverride].each do |klass|
            klass.where(user_id: user).in_batches.delete_all
          end
          MentorCaseload.where(student_id: user).or(MentorCaseload.where(mentor_id: user)).in_batches.delete_all
        end
      end

      # Moves +from_user+'s rows on the current shard to +target_user+, adding
      # totals together where both users have a row for the same day or item.
      # Progress rows are dropped and rebuilt for the target user.
      def merge(from_user, target_user)
        move(ActivityDay, from_user, target_user, %i[user_id course_id day], ActivityLedger::DAY_MERGE_SQL)
        move(ItemTime, from_user, target_user, %i[user_id content_tag_id], ActivityLedger::ITEM_MERGE_SQL)
        move_caseloads(from_user, target_user)
        move_video_progress(from_user, target_user)
        ItemOverride.where(user_id: from_user).update_all(user_id: target_user.id)

        states = StudentCourseState.where(user_id: from_user)
        states.pluck(:course_id, :root_account_id).each do |course_id, root_account_id|
          StateRefresher.enqueue(root_account_id:, course_id:, user_id: target_user.id)
        end
        states.delete_all
      end

      private

      # Keeps the higher share watched when both users watched the same video.
      def move_video_progress(from_user, target_user)
        VideoProgress.where(user_id: from_user).find_each do |row|
          existing = VideoProgress.find_by(user_id: target_user.id, content_tag_id: row.content_tag_id)
          if existing
            existing.update!(max_fraction: [existing.max_fraction, row.max_fraction].max,
                             completed_at: [existing.completed_at, row.completed_at].compact.min)
            row.delete
          else
            row.update_columns(user_id: target_user.id)
          end
        end
      end

      # Caseload pins follow the user on both sides: as the pinned student and
      # as the staff member who pinned.
      def move_caseloads(from_user, target_user)
        %i[student_id mentor_id].each do |column|
          MentorCaseload.where(column => from_user).find_each do |pin|
            attributes = pin.attributes.slice("mentor_id", "student_id", "root_account_id").merge(column.to_s => target_user.id)
            MentorCaseload.create_or_find_by!(attributes) unless attributes["mentor_id"] == attributes["student_id"]
            pin.delete
          end
        end
      end

      def move(klass, from_user, target_user, unique_by, merge_sql)
        klass.where(user_id: from_user).find_in_batches(batch_size: 500) do |rows|
          attributes = rows.map { |row| row.attributes.except("id").merge("user_id" => target_user.id) }
          klass.upsert_all(attributes, unique_by:, on_duplicate: Arel.sql(merge_sql), record_timestamps: false)
          klass.where(id: rows.map(&:id)).delete_all
        end
      end
    end
  end
end
