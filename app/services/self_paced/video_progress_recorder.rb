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

# Records video watching reported by the browser and meets the must_watch
# requirement once enough has been watched (docs/fork-plan.md §2.9,
# docs/spikes/video-tracking.md).
#
# The browser can be made to lie, so progress is capped by wall-clock time:
# nobody watches faster than SPEED_ALLOWANCE times normal speed, plus a little
# slack for the first report. That stops casual skipping, not tampering.
module SelfPaced
  class VideoProgressRecorder
    SPEED_ALLOWANCE = 2.0
    SLACK_SECONDS = 60

    def self.record(user:, course:, tag:, fraction:, duration:, at: Time.zone.now)
      setting = ItemSetting.find_by(content_tag: tag)
      return unless setting&.watch_fraction

      progress = VideoProgress.find_or_initialize_by(user:, content_tag: tag) do |p|
        p.course = course
        p.first_reported_at = at
      end
      duration = duration.to_f
      fraction = fraction.to_f.clamp(0.0, 1.0)
      if duration.positive?
        allowed = (((at - progress.first_reported_at) * SPEED_ALLOWANCE) + SLACK_SECONDS) / duration
        fraction = [fraction, allowed].min
        progress.duration_seconds = duration
      end
      progress.max_fraction = [progress.max_fraction.to_f, fraction].max

      if progress.completed_at.nil? && progress.max_fraction >= setting.watch_fraction - 1e-6
        progress.completed_at = at
        progress.save!
        tag.context_module_action(user, :watched)
      else
        progress.save!
      end
      progress
    end
  end
end
