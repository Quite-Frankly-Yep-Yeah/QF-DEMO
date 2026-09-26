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

# Records student activity for self-paced courses (docs/fork-plan.md §2.7).
#
# Everything is a single upsert that adds to the existing totals, so pings can
# arrive in any order, twice, or from several tabs without losing or double
# counting a row. Only aggregates are stored: no URLs, IP addresses or user
# agents.
module SelfPaced
  class ActivityLedger
    # The browser pings every 60 seconds; allow some slack for timer drift and
    # the final beacon when a page closes.
    MAX_SECONDS_PER_PING = 90
    SECONDS_PER_DAY = 86_400

    # Shared with SelfPaced::UserData, which merges rows with the same rules.
    DAY_MERGE_SQL = <<~SQL.squish
      active_seconds = LEAST(activity_days.active_seconds + EXCLUDED.active_seconds, #{SECONDS_PER_DAY}),
      submissions_count = activity_days.submissions_count + EXCLUDED.submissions_count,
      content_tag_ids = ARRAY(SELECT DISTINCT unnest(activity_days.content_tag_ids || EXCLUDED.content_tag_ids)),
      first_activity_at = LEAST(activity_days.first_activity_at, EXCLUDED.first_activity_at),
      last_activity_at = GREATEST(activity_days.last_activity_at, EXCLUDED.last_activity_at),
      updated_at = EXCLUDED.updated_at
    SQL

    ITEM_MERGE_SQL = <<~SQL.squish
      active_seconds = item_times.active_seconds + EXCLUDED.active_seconds,
      first_viewed_at = LEAST(item_times.first_viewed_at, EXCLUDED.first_viewed_at),
      last_viewed_at = GREATEST(item_times.last_viewed_at, EXCLUDED.last_viewed_at),
      updated_at = EXCLUDED.updated_at
    SQL

    # viewing_since restarts only when the student moves to a different page.
    PRESENCE_SQL = <<~SQL.squish
      last_seen_at = GREATEST(student_course_states.last_seen_at, EXCLUDED.last_seen_at),
      last_active_at = GREATEST(student_course_states.last_active_at, EXCLUDED.last_active_at),
      viewing_since = CASE
        WHEN student_course_states.viewing_content_tag_id IS NOT DISTINCT FROM EXCLUDED.viewing_content_tag_id
        THEN student_course_states.viewing_since
        ELSE EXCLUDED.viewing_since
      END,
      viewing_content_tag_id = EXCLUDED.viewing_content_tag_id,
      updated_at = EXCLUDED.updated_at
    SQL

    # A ping from the browser: +seconds+ of active time (0 means the page is
    # open but the student is idle) while on +content_tag+ (nil when the page
    # isn't a module item).
    def self.record_ping(user:, course:, seconds:, content_tag: nil, at: Time.zone.now)
      new(user:, course:, at:).record_ping(seconds.to_i.clamp(0, MAX_SECONDS_PER_PING), content_tag)
    end

    # A submission counts toward the day's engagement.
    def self.record_submission(user:, course:, at:)
      new(user:, course:, at:).record_submission
    end

    def initialize(user:, course:, at:)
      @user = user
      @course = course
      @at = at
    end

    def record_ping(seconds, content_tag)
      @course.shard.activate do
        record_presence(seconds, content_tag)
        next if seconds.zero?

        add_to_day(active_seconds: seconds, content_tag_ids: Array(content_tag&.id))
        add_to_item(seconds, content_tag) if content_tag
      end
    end

    def record_submission
      @course.shard.activate { add_to_day(submissions_count: 1) }
    end

    private

    def day
      @at.in_time_zone(@course.time_zone).to_date
    end

    def base_attributes
      { user_id: @user.id, course_id: @course.id, root_account_id: @course.root_account_id, created_at: @at, updated_at: @at }
    end

    def add_to_day(active_seconds: 0, submissions_count: 0, content_tag_ids: [])
      ActivityDay.upsert_all(
        [base_attributes.merge(day:,
                               active_seconds:,
                               submissions_count:,
                               content_tag_ids:,
                               first_activity_at: @at,
                               last_activity_at: @at)],
        unique_by: %i[user_id course_id day],
        on_duplicate: Arel.sql(DAY_MERGE_SQL),
        record_timestamps: false
      )
    end

    def add_to_item(seconds, content_tag)
      ItemTime.upsert_all(
        [base_attributes.merge(content_tag_id: content_tag.id,
                               active_seconds: seconds,
                               first_viewed_at: @at,
                               last_viewed_at: @at)],
        unique_by: %i[user_id content_tag_id],
        on_duplicate: Arel.sql(ITEM_MERGE_SQL),
        record_timestamps: false
      )
    end

    def record_presence(seconds, content_tag)
      StudentCourseState.upsert_all(
        [base_attributes.merge(last_seen_at: @at,
                               last_active_at: seconds.positive? ? @at : nil,
                               viewing_content_tag_id: content_tag&.id,
                               viewing_since: @at)],
        unique_by: %i[course_id user_id],
        on_duplicate: Arel.sql(PRESENCE_SQL),
        record_timestamps: false
      )
    end
  end
end
