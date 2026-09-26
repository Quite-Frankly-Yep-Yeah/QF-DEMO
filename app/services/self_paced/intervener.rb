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

# The one way staff change things for a student (docs/fork-plan.md §2.5). Each
# tool checks its permissions, does its work and writes an append-only
# SelfPaced::Intervention row in the same transaction.
#
#   intervener = SelfPaced::Intervener.new(course, teacher, real_actor: admin)
#   intervener.perform("unlock", student:, content_tag:, reason: "Absent for the lesson")
#
# | kind           | does                                                  | needs                                        |
# |----------------|-------------------------------------------------------|----------------------------------------------|
# | unlock         | unlock override (and quiz manually_unlocked)          | self_paced_unlock_items                      |
# | mark_complete  | complete override                                     | self_paced_unlock_items                      |
# | exempt         | exempt override; excuses a graded item                | self_paced_unlock_items (+ manage_grades)    |
# | undo           | removes one of the three overrides above              | same as the override                         |
# | extra_attempts | more attempts on a quiz or assignment                 | self_paced_manage_attempts + manage_grades   |
# | reset_attempt  | one more attempt; the old one is logged as reset      | self_paced_manage_attempts + manage_grades   |
# | adjust_target  | the student's own finish date, or back to the course's| self_paced_adjust_pacing                     |
# | note           | a staff-only note                                     | self_paced_manage_notes                      |
# | delete_note    | removes the actor's own note                          | self_paced_manage_notes                      |
# | message        | a private Conversations message to the student        | send_messages                                |
module SelfPaced
  class Intervener
    # The actor may not do this.
    class Denied < StandardError; end

    # The request doesn't make sense (no such item, nothing to undo, ...).
    class Invalid < StandardError; end

    ITEM_KINDS = %w[unlock mark_complete exempt undo extra_attempts reset_attempt].freeze
    MAX_EXTRA_ATTEMPTS = 10

    # Changing a student's finish date shipped with pacing (Phase 4), so it
    # works without the interventions flag. It is still logged.
    FLAG_FREE_KINDS = %w[adjust_target].freeze

    def self.enabled?(course)
      SelfPaced.feature_enabled?(course, :self_paced_interventions)
    end

    attr_reader :course, :actor, :real_actor

    def initialize(course, actor, real_actor: nil, progress: nil)
      @course = course
      @actor = actor
      @real_actor = (real_actor && real_actor != actor) ? real_actor : nil
      @progress = progress
    end

    # Which tools the actor can use in this course, for the UI.
    def tools
      enabled = self.class.enabled?(course)
      items = enabled && right?(:self_paced_unlock_items)
      attempts = enabled && right?(:self_paced_manage_attempts) && right?(:manage_grades)
      {
        unlock: items,
        mark_complete: items,
        exempt: items,
        exempt_graded: items && right?(:manage_grades),
        extra_attempts: attempts,
        reset_attempt: attempts,
        adjust_target: right?(:self_paced_adjust_pacing) && Pacer.course?(course),
        note: enabled && right?(:self_paced_manage_notes),
        message: enabled && right?(:send_messages)
      }
    end

    # Does +kind+ for +student+ and returns the logged Intervention.
    def perform(kind, student:, content_tag: nil, reason: nil, **)
      kind = kind.to_s
      raise Invalid, "unknown intervention: #{kind}" unless Intervention::KINDS.include?(kind)
      raise Denied, "interventions are off for this course" unless FLAG_FREE_KINDS.include?(kind) || self.class.enabled?(course)
      raise Invalid, "not a student in this course" unless student_in_course?(student)

      if ITEM_KINDS.include?(kind)
        content_tag = resolve_tag(content_tag)
        raise Invalid, "choose an item in this course" unless content_tag
      end

      Intervention.transaction do
        payload = send(:"do_#{kind}", student, content_tag, **)
        log!(kind, student, content_tag, reason, payload)
      end
    end

    private

    def right?(permission)
      @rights ||= {}
      @rights.fetch(permission) { @rights[permission] = course.grants_right?(actor, permission) }
    end

    def require!(*permissions)
      missing = permissions.reject { |permission| right?(permission) }
      raise Denied, "missing permission: #{missing.join(", ")}" if missing.any?
    end

    def student_in_course?(student)
      student && course.student_enrollments.active.where(user_id: student).exists?
    end

    # A module item in this course, given as a ContentTag or its id.
    def resolve_tag(tag)
      tag = ContentTag.find_by(id: tag) unless tag.is_a?(ContentTag)
      return nil unless tag && tag.context_type == "Course" && tag.context_id == course.id
      return nil if tag.deleted? || tag.tag_type != "context_module"

      tag
    end

    def log!(kind, student, content_tag, reason, payload)
      Intervention.create!(course:,
                           student:,
                           actor:,
                           real_actor:,
                           content_tag:,
                           progress: @progress,
                           kind:,
                           reason: reason.presence,
                           payload: payload || {})
    end

    # --- items -------------------------------------------------------------

    def do_unlock(student, tag, **)
      require!(:self_paced_unlock_items)
      add_override(student, tag, "unlock")
      quiz = quiz_for(tag)
      return {} unless quiz

      quiz_submission(quiz, student).tap { |qs| qs.manually_unlocked = true }.save!
      { quiz_unlocked: true }
    end

    def do_mark_complete(student, tag, **)
      require!(:self_paced_unlock_items)
      add_override(student, tag, "complete")
      {}
    end

    # Takes the item out of gating and pacing. A graded item is also excused,
    # so it doesn't count toward the grade.
    def do_exempt(student, tag, **)
      require!(:self_paced_unlock_items)
      assignment = graded_assignment(tag)
      require!(:manage_grades) if assignment
      add_override(student, tag, "exempt")
      return {} unless assignment

      assignment.grade_student(student, excused: true, grader: actor)
      { excused: true, assignment_id: assignment.id }
    end

    def do_undo(student, tag, override_kind: nil, **)
      override_kind = override_kind.to_s
      raise Invalid, "choose unlock, exempt or complete to undo" unless ItemOverride::KINDS.include?(override_kind)

      require!(:self_paced_unlock_items)
      override = ItemOverride.active.find_by(content_tag: tag, user: student, kind: override_kind)
      raise Invalid, "there is no #{override_kind} to undo on this item" unless override

      payload = { override_kind: }
      assignment = (override_kind == "exempt") && graded_assignment(tag)
      require!(:manage_grades) if assignment
      override.destroy
      if assignment&.excused_for?(student)
        assignment.grade_student(student, excused: false, grader: actor)
        payload[:unexcused] = true
      end
      if override_kind == "unlock" && (quiz = quiz_for(tag))
        quiz_submission(quiz, student).tap { |qs| qs.manually_unlocked = false }.save!
      end
      payload
    end

    def do_extra_attempts(student, tag, attempts: 1, **)
      require!(:self_paced_manage_attempts, :manage_grades)
      count = attempts.to_i
      raise Invalid, "attempts must be between 1 and #{MAX_EXTRA_ATTEMPTS}" unless count.between?(1, MAX_EXTRA_ATTEMPTS)

      { attempts: count, **add_attempts(student, tag, count) }
    end

    # Decision 7: the old attempt stays as evidence; the student gets one more
    # try and the log records which attempt was reset and its score.
    def do_reset_attempt(student, tag, **)
      require!(:self_paced_manage_attempts, :manage_grades)
      latest = latest_attempt(student, tag)
      raise Invalid, "there is no attempt to reset" unless latest

      { reset_attempt: latest, **add_attempts(student, tag, 1) }
    end

    def add_override(student, tag, kind)
      ItemOverride.active.find_by(content_tag: tag, user: student, kind:) ||
        ItemOverride.create!(content_tag: tag, user: student, kind:, created_by: actor)
    end

    def quiz_for(tag)
      tag.content if tag.content_type == "Quizzes::Quiz"
    end

    def quiz_submission(quiz, student)
      Quizzes::SubmissionManager.new(quiz).find_or_create_submission(student, state: "settings_only")
    end

    def graded_assignment(tag)
      ItemFacts.graded_assignment(tag.content)
    end

    def add_attempts(student, tag, count)
      if (quiz = quiz_for(tag))
        raise Invalid, "this quiz already allows unlimited attempts" if quiz.allowed_attempts.to_i.negative?

        submission = quiz_submission(quiz, student)
        submission.extra_attempts = submission.extra_attempts.to_i + count
        submission.save!
        return { extra_attempts_total: submission.extra_attempts, allowed_attempts: quiz.allowed_attempts }
      end

      assignment = tag.content
      raise Invalid, "only quizzes and assignments have attempts" unless assignment.is_a?(Assignment)
      raise Invalid, "this assignment already allows unlimited attempts" unless assignment.allowed_attempts.to_i.positive?

      submission = assignment.find_or_create_submission(student)
      submission.extra_attempts = submission.extra_attempts.to_i + count
      raise Invalid, submission.errors.full_messages.to_sentence unless submission.save

      { extra_attempts_total: submission.extra_attempts, allowed_attempts: assignment.allowed_attempts }
    end

    # { attempt:, score:, workflow_state: } for the student's last attempt.
    def latest_attempt(student, tag)
      if (quiz = quiz_for(tag))
        submission = quiz.quiz_submissions.find_by(user_id: student)
        return nil unless submission && submission.attempt.to_i.positive?

        { attempt: submission.attempt, score: submission.kept_score, workflow_state: submission.workflow_state }
      elsif tag.content.is_a?(Assignment)
        submission = tag.content.submissions.active.find_by(user_id: student)
        return nil unless submission && submission.attempt.to_i.positive?

        { attempt: submission.attempt, score: submission.score, workflow_state: submission.workflow_state }
      end
    end

    # --- pacing ------------------------------------------------------------

    def do_adjust_target(student, _tag, target_date: nil, reset: false, **)
      require!(:self_paced_adjust_pacing)
      pacer = Pacer.new(course, student)
      raise Invalid, "this course isn't paced" unless Pacer.course?(course) && pacer.refresh!

      before = pacer.plan.target_date
      if reset
        pacer.reset_target!(actor:)
      else
        date = target_date.is_a?(Date) ? target_date : parse_date(target_date)
        raise Invalid, "target_date must be a date (YYYY-MM-DD)" unless date

        pacer.set_target!(date, actor:)
      end
      StateRefresher.enqueue(root_account_id: course.root_account_id, course_id: course.id, user_id: student.id)
      { from: before&.iso8601, to: pacer.plan.target_date.iso8601, source: pacer.plan.target_source }
    end

    def parse_date(value)
      Date.iso8601(value.to_s)
    rescue Date::Error
      nil
    end

    # --- notes and messages ------------------------------------------------

    def do_note(student, _tag, body: nil, **)
      require!(:self_paced_manage_notes)
      note = StudentNote.new(student:, author: actor, course:, body: body.to_s.strip)
      raise Invalid, note.errors.full_messages.to_sentence unless note.save

      { note_id: note.id.to_s }
    end

    def do_delete_note(student, _tag, note_id: nil, **)
      require!(:self_paced_manage_notes)
      note = StudentNote.active.find_by(id: note_id, student:)
      raise Invalid, "no such note" unless note
      raise Denied, "only the author can delete a note" unless note.author_id == actor.id

      note.destroy
      { note_id: note.id.to_s }
    end

    def do_message(student, _tag, body: nil, subject: nil, **)
      require!(:send_messages)
      body = body.to_s.strip
      raise Invalid, "write a message" if body.empty?

      subject = subject.to_s.strip.presence || course.name
      participant = actor.initiate_conversation([student], true, subject:, context_type: "Course", context_id: course.id)
      message = participant.add_message(body, tags: [course.asset_string], update_for_sender: false, cc_author: true)
      { conversation_id: participant.conversation_id.to_s, message_id: message.id.to_s, subject: }
    end
  end
end
