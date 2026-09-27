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

# Retention and user merges for student supports data
# (docs/teacher-workflow-plan.md §2.2, Q9): kept until the student's user is
# deleted, and moved with them when two users are merged.
module Supports
  module UserData
    class << self
      def purge_later(user)
        delay(priority: Delayed::LOW_PRIORITY).purge(user.id)
      end

      def purge(user_id)
        user = User.find_by(id: user_id)
        return unless user

        Shard.with_each_shard(user.associated_shards) do
          Caseload.where(student_id: user).or(Caseload.where(staff_id: user)).in_batches.delete_all
          # the record of who opened this student's files goes with them; rows
          # where they were the viewer stay, as the record for other students
          AccessLog.where(student_id: user).in_batches.delete_all
        end
      end

      # Moves +from_user+'s rows on the current shard to +target_user+.
      def merge(from_user, target_user)
        Caseload.where(student_id: from_user).find_each do |row|
          if Caseload.assigned?(row.staff, target_user, row.root_account)
            row.delete
          else
            row.update_columns(student_id: target_user.id)
          end
        end
        Caseload.where(staff_id: from_user).find_each do |row|
          if Caseload.assigned?(target_user, row.student, row.root_account)
            row.delete
          else
            row.update_columns(staff_id: target_user.id)
          end
        end
        %i[student_id viewer_id real_user_id].each { |column| move_log_rows(column, from_user, target_user) }
      end

      private

      # A row that would duplicate one the target user already has for the
      # same hour is dropped instead.
      def move_log_rows(column, from_user, target_user)
        AccessLog.where(column => from_user).find_each do |row|
          AccessLog.transaction(requires_new: true) do
            AccessLog.where(id: row.id).update_all(column => target_user.id)
          end
        rescue ActiveRecord::RecordNotUnique
          AccessLog.where(id: row.id).delete_all
        end
      end
    end
  end
end
