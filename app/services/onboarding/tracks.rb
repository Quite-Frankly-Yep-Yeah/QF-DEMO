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

# The onboarding checklists (docs/onboarding-plan.md). A track is one role's
# checklist; a step is one thing to do, with a page to do it on. A step with a
# +check+ is ticked by the system when the check passes; any step can also be
# marked done or set aside by hand (Onboarding::Progress).
#
# Tracks are built per call so titles follow the request's locale.
module Onboarding
  module Tracks
    Step = Data.define(:key, :title, :description, :url, :check, :optional) do
      def initialize(key:, title:, description:, url:, check: nil, optional: false)
        super
      end

      def detectable?
        !check.nil?
      end

      # true or false when the step can be detected, nil when it can't. A
      # check that raises counts as not done, so one broken check never takes
      # the checklist down.
      def detected(context)
        return nil unless detectable?

        !!check.call(context)
      rescue => e
        Rails.logger.warn("[onboarding] check #{key} failed: #{e.class}")
        false
      end
    end

    Track = Data.define(:key, :title, :url, :available, :steps) do
      def available?(context)
        !!available.call(context)
      end

      def step(step_key)
        steps.find { |s| s.key == step_key }
      end
    end

    Context = Data.define(:user, :root_account)

    def self.all(root_account)
      [InstallTrack.build(root_account)]
    end

    def self.find(root_account, track_key)
      all(root_account).find { |t| t.key == track_key }
    end

    def self.available(user, root_account)
      context = Context.new(user:, root_account:)
      all(root_account).select { |t| t.available?(context) }
    end
  end
end
