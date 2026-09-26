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

# Small rules the module progression engine asks about in self-paced courses
# (docs/fork-plan.md §2.1). Everything answers "no" outside courses with the
# course player on, so ordinary courses behave exactly as before.
module SelfPaced
  module Gating
    class << self
      def player_course?(course)
        course.is_a?(Course) && SelfPaced.feature_enabled?(course, :self_paced_course_player)
      end

      # Provisional mode (decision 3): a submitted check that is still waiting
      # for a teacher's grade counts as met, so the student can keep going.
      def provisional?(course)
        player_course?(course) && course.self_paced_provisional_checks
      end

      def provisional_pass?(course, submissions)
        provisional?(course) && Array(submissions).any? { |submission| awaiting_grade?(submission) }
      end

      def awaiting_grade?(submission)
        case submission
        when Quizzes::QuizSubmission
          submission.workflow_state == "pending_review"
        when Submission
          submission.workflow_state == "pending_review" ||
            (submission.workflow_state == "submitted" && submission.submitted_at.present? && submission.score.nil?)
        else
          false
        end
      end
    end
  end
end
