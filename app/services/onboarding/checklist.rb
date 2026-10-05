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

# One person's view of one onboarding track: each step with whether the
# system detected it, whether they marked it done or set it aside, and the
# count of required steps done.
module Onboarding
  class Checklist
    attr_reader :track, :user, :root_account

    def initialize(track, user, root_account)
      @track = track
      @user = user
      @root_account = root_account
    end

    def context
      @context ||= Tracks::Context.new(user:, root_account:)
    end

    def progress
      @progress ||= Progress.owned_by(user, root_account).in_track(track.key).index_by(&:step_key)
    end

    def steps_json
      @steps_json ||= track.steps.map { |step| step_json(step) }
    end

    def summary_json
      required = steps_json.reject { |s| s[:optional] }
      {
        key: track.key,
        title: track.title,
        url: track.url,
        done_count: required.count { |s| s[:done] },
        total: required.size
      }
    end

    def as_json
      summary_json.merge(steps: steps_json)
    end

    # Marks a step done or not done, set aside or not, by hand. Either value
    # may be omitted to leave it as it is.
    def mark(step, done: nil, dismissed: nil)
      row = Progress.find_or_initialize_by(user:, root_account:, step_key: full_key(step))
      row.completed_at = done ? (row.completed_at || Time.zone.now) : nil unless done.nil?
      row.dismissed_at = dismissed ? (row.dismissed_at || Time.zone.now) : nil unless dismissed.nil?
      if row.completed_at || row.dismissed_at
        row.save!
      elsif row.persisted?
        row.destroy
      end
      @progress = @steps_json = nil
    end

    # Forgets everything marked by hand on this track, to start over.
    def reset!
      Progress.owned_by(user, root_account).in_track(track.key).delete_all
      @progress = @steps_json = nil
    end

    private

    def full_key(step)
      "#{track.key}.#{step.key}"
    end

    def step_json(step)
      row = progress[full_key(step)]
      detected = step.detected(context)
      {
        key: step.key,
        title: step.title,
        description: step.description,
        url: step.url,
        optional: step.optional,
        detectable: step.detectable?,
        detected:,
        completed_at: row&.completed_at,
        dismissed_at: row&.dismissed_at,
        done: detected == true || row&.completed_at.present?
      }
    end
  end
end
