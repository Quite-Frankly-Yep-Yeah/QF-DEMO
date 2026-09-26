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

# Entry points for the one-line callbacks added to core models. Each one bails
# out after a cached account lookup when self-paced is off, so courses that
# don't use it pay almost nothing.
module SelfPaced
  module ModelHooks
    class << self
      def submission_committed(submission)
        return unless on_for_root_account?(submission.root_account_id)

        course = submission.course
        return unless course && SelfPaced.feature_enabled?(course, :self_paced_activity_tracking)
        return if submission.user.nil? || submission.user.fake_student?

        if submission.saved_change_to_submitted_at? && submission.submitted_at
          ActivityLedger.record_submission(user: submission.user, course:, at: submission.submitted_at)
        end
        StateRefresher.enqueue(root_account_id: submission.root_account_id,
                               course_id: submission.course_id,
                               user_id: submission.user_id)
      end

      def progression_committed(progression)
        return unless on_for_root_account?(progression.root_account_id)

        context_module = progression.context_module
        return unless context_module&.context_type == "Course"

        StateRefresher.enqueue(root_account_id: progression.root_account_id,
                               course_id: context_module.context_id,
                               user_id: progression.user_id)
      end

      # A skill result came in (Phase 9): if it is a mastery, test-out may skip
      # the lessons that teach that skill.
      def outcome_result_committed(result)
        return unless result.mastery && on_for_root_account?(result.root_account_id)

        TestOut.result_committed(result)
      end

      def score_committed(score)
        return unless score.course_score && on_for_root_account?(score.root_account_id)

        enrollment = score.enrollment
        return unless enrollment.is_a?(StudentEnrollment)

        StateRefresher.enqueue(root_account_id: score.root_account_id,
                               course_id: enrollment.course_id,
                               user_id: enrollment.user_id)
      end

      private

      def on_for_root_account?(root_account_id)
        root_account_id.present? && !!Account.find_cached(root_account_id)&.feature_enabled?(:self_paced)
      end
    end
  end
end
