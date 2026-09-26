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

# One row of the append-only intervention log (docs/fork-plan.md §2.5): what
# staff did for a student, who did it (and who was really at the keyboard
# while masquerading), on which item, why, and the details.
#
# Rows are written by SelfPaced::Intervener and never changed. Only a user
# deletion or merge (SelfPaced::UserData) touches them afterwards.
module SelfPaced
  class Intervention < ApplicationRecord
    self.table_name = "interventions"

    KINDS = %w[
      unlock
      extra_attempts
      reset_attempt
      exempt
      mark_complete
      undo
      adjust_target
      note
      delete_note
      message
    ].freeze

    belongs_to :root_account, class_name: "Account"
    belongs_to :course
    belongs_to :student, class_name: "User"
    belongs_to :actor, class_name: "User"
    belongs_to :real_actor, class_name: "User", optional: true
    belongs_to :content_tag, optional: true
    belongs_to :progress, optional: true

    validates :kind, inclusion: { in: KINDS }

    before_validation { self.root_account_id ||= course&.root_account_id }

    def readonly?
      persisted?
    end

    def destroy
      raise ActiveRecord::ReadOnlyRecord, "interventions are append-only"
    end

    def as_json_for_log
      {
        id: id.to_s,
        kind:,
        created_at: created_at.iso8601,
        actor: { id: actor_id.to_s, name: actor.name },
        real_actor: real_actor && { id: real_actor_id.to_s, name: real_actor.name },
        item: content_tag && { id: content_tag_id.to_s, title: content_tag.title },
        reason:,
        payload:,
        bulk: progress_id.present?
      }
    end
  end
end
