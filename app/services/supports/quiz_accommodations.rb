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

# Extended time and extra attempts on classic quizzes
# (docs/teacher-workflow-plan.md §2.3, Phase 2).
#
# - Extended time applies to timed quizzes only (Q7). When an attempt starts,
#   the submission's extra time is raised to what the accommodation gives.
# - Extra attempts raise the submission's extra attempts.
# - Neither ever lowers what a teacher already gave, and the Moderate page
#   can't take them below the accommodation.
# - An attempt that started before the quiz locks gets its full time, even past
#   the lock date or the end of the enrollment (the user's choice for R3). New
#   attempts still can't start after the lock.
module Supports
  module QuizAccommodations
    MAX_EXTRA_TIME = 10_080 # Quizzes::QuizSubmission's limit, one week
    MAX_EXTRA_ATTEMPTS = 1000

    class << self
      # [minutes, accommodation] for the largest extended time +student+ has
      # on +quiz+, or nil.
      def extended_time(quiz, student)
        return nil unless quiz.time_limit.to_f.positive?

        Applier.current(student, quiz.context, "extended_time")
               .map { |accommodation| [minutes_for(accommodation, quiz.time_limit), accommodation] }
               .select { |minutes, _| minutes.positive? }
               .max_by(&:first)
      end

      # [attempts, accommodation] for the most extra attempts, or nil.
      def extra_attempts(quiz, student)
        return nil if quiz.unlimited_attempts?

        Applier.current(student, quiz.context, "extra_attempts")
               .map { |accommodation| [accommodation.parameters["attempts"].to_i.clamp(0, MAX_EXTRA_ATTEMPTS), accommodation] }
               .select { |attempts, _| attempts.positive? }
               .max_by(&:first)
      end

      def minutes_for(accommodation, time_limit)
        params = accommodation.parameters
        minutes = if params["multiplier"].present?
                    ((params["multiplier"].to_f - 1) * time_limit.to_f).ceil
                  else
                    params["minutes"].to_i
                  end
        minutes.clamp(0, MAX_EXTRA_TIME)
      end

      # Raises +submission+'s extra time and attempts to the accommodations'
      # and records what was applied. Doesn't save the submission.
      # +attempt_started+ records the extended time for this attempt even when
      # the submission already had it (a retake).
      def apply!(submission, attempt_started: false)
        student = submission.user
        return false unless student.is_a?(User) && submission.persisted? && !submission.preview?

        quiz = submission.quiz
        applied = false
        if (time = extended_time(quiz, student))
          minutes, accommodation = time
          before = submission.extra_time
          submission.extra_time = minutes if before.to_i < minutes
          if attempt_started || before.to_i < minutes
            Application.record!(accommodation,
                                kind: "extended_time",
                                context: submission,
                                course: quiz.context,
                                details: { quiz_id: quiz.id.to_s,
                                           attempt: submission.attempt,
                                           minutes:,
                                           before:,
                                           after: submission.extra_time })
            applied = true
          end
        end
        if (extra = extra_attempts(quiz, student)) && submission.extra_attempts.to_i < extra[0]
          attempts, accommodation = extra
          Application.record!(accommodation,
                              kind: "extra_attempts",
                              context: submission,
                              course: quiz.context,
                              details: { quiz_id: quiz.id.to_s, before: submission.extra_attempts, after: attempts })
          submission.extra_attempts = attempts
          applied = true
        end
        applied
      end

      # Brings the student's existing submissions in +course+ up to their
      # accommodations (they changed, or one started today).
      def sync(student, course)
        return if Applier.current(student, course, %w[extended_time extra_attempts]).empty?

        Quizzes::QuizSubmission.joins(:quiz).where(user_id: student.id, quizzes: { context_id: course.id, context_type: "Course" })
                               .where.not(workflow_state: "preview").preload(:quiz).find_each do |submission|
          next unless submission.quiz.available?

          submission.class.transaction do
            submission.save! if apply!(submission) && submission.changed?
          end
        end
      end

      # The end of an accommodated attempt, uncapped by the lock date or the
      # enrollment's end, or nil when the attempt isn't accommodated.
      def end_at_past_lock(quiz, submission)
        return nil unless quiz.time_limit.to_f.positive? && submission.started_at && submission.extra_time.to_i.positive?
        return nil unless submission.user.is_a?(User) && !submission.preview?
        return nil if quiz.lock_at && submission.started_at >= quiz.lock_at

        minutes, = extended_time(quiz, submission.user)
        return nil unless minutes && submission.extra_time.to_i >= minutes

        submission.started_at + ((quiz.time_limit.to_f + submission.extra_time.to_i) * 60.0)
      end

      # Whether +user+ is in an accommodated attempt that runs past the lock
      # date, so the quiz still opens for them to finish it.
      def running_past_lock?(quiz, user)
        return false unless user.is_a?(User) && !user.new_record? && quiz.time_limit.to_f.positive?
        return false unless Applier.course_enabled?(quiz.context)

        submission = quiz.quiz_submissions.where(user_id: user.id).first
        return false unless submission&.untaken? && submission.end_at && submission.end_at > Time.zone.now

        end_at_past_lock(quiz, submission).present?
      end

      # {user_id => {minutes:, attempts:}} for the Moderate page.
      def floors(quiz, student_ids)
        course = quiz.context
        return {} unless Applier.course_enabled?(course)

        rows = StudentAccommodation.current
                                   .where(student_id: student_ids, root_account_id: course.root_account_id)
                                   .joins(:accommodation_type)
                                   .where(accommodation_types: { kind: %w[extended_time extra_attempts] })
                                   .where("student_accommodations.course_ids = '{}' OR ? = ANY(student_accommodations.course_ids)", course.id)
                                   .preload(:accommodation_type)
        rows.group_by(&:student_id).each_with_object({}) do |(student_id, accommodations), result|
          minutes = if quiz.time_limit.to_f.positive?
                      accommodations.select { |row| row.kind == "extended_time" }
                                    .map { |row| minutes_for(row, quiz.time_limit) }.max
                    end
          attempts = unless quiz.unlimited_attempts?
                       accommodations.select { |row| row.kind == "extra_attempts" }
                                     .map { |row| row.parameters["attempts"].to_i.clamp(0, MAX_EXTRA_ATTEMPTS) }.max
                     end
          minutes = nil unless minutes&.positive?
          attempts = nil unless attempts&.positive?
          result[student_id] = { minutes:, attempts: } if minutes || attempts
        end
      end
    end
  end
end
