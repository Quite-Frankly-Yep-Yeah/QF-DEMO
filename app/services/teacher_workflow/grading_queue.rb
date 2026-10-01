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

module TeacherWorkflow
  # The grading queue (docs/superpowers/specs/2026-10-01-grading-queue-design.md):
  # the ungraded work in every course a viewer grades, ranked by how much it
  # holds a student up, then oldest first. Computed on read; nothing is stored.
  class GradingQueue
    SCAN_CAP = 500
    PER_PAGE = 25
    CACHE_FOR = 60.seconds
    ANONYMOUS = "Anonymous student"

    def initialize(viewer, course_id: nil, unit_id: nil, student_id: nil, held_up: false, page: 1, now: Time.zone.now)
      @viewer = viewer
      @course_id = course_id
      @unit_id = unit_id
      @student_id = student_id
      @held_up = ActiveModel::Type::Boolean.new.cast(held_up)
      @page = [page.to_i, 1].max
      @now = now
    end

    def result
      return build_result if Rails.env.test?

      Rails.cache.fetch(cache_key, expires_in: CACHE_FOR) { build_result }
    end

    private

    def cache_key
      ["teacher_workflow_grading_queue", @viewer&.global_id, @course_id, @unit_id, @student_id, @held_up, @page].cache_key
    end

    def build_result
      rows = Courses.for(@viewer, course_id: @course_id).flat_map { |entry| rows_for(entry) }
      rows.sort_by! { |row| [row[:tier], row[:submitted_at] || "9999", row[:id].to_i] }
      truncated = rows.size > SCAN_CAP || @scan_truncated
      rows = rows.first(SCAN_CAP)
      rows = rows.select { |row| row[:tier] <= Tiering::COULD_RELOCK } if @held_up
      {
        rows: rows.slice((@page - 1) * PER_PAGE, PER_PAGE) || [],
        page: @page,
        per_page: PER_PAGE,
        total: rows.size,
        truncated: !!truncated,
        tier_counts: (1..4).index_with { |tier| rows.count { |row| row[:tier] == tier } }
      }
    end

    def rows_for(entry)
      course = entry.course
      index = ItemIndex.new(course)
      player = SelfPaced::Gating.player_course?(course)
      provisional = SelfPaced::Gating.provisional?(course)
      submissions = waiting(entry)
      @scan_truncated ||= submissions.size > SCAN_CAP
      states = SelfPaced::StudentCourseState.where(course:, user_id: submissions.map(&:user_id)).index_by(&:user_id)

      submissions.first(SCAN_CAP).filter_map do |submission|
        assignment = submission.assignment
        item = index.for_assignment(assignment)
        next if @unit_id.present? && item&.unit_id != @unit_id.to_i

        anonymous = assignment.anonymize_students?
        next if anonymous && @student_id.present?

        current = states[submission.user_id]&.current_content_tag_id&.then { |id| index.for_tag_id(id) }
        tier = Tiering.call(due_at: submission.cached_due_date,
                            item:,
                            current_item: current,
                            player:,
                            provisional:,
                            now: @now)
        build_row(submission, course, item, tier, anonymous)
      end
    end

    def waiting(entry)
      scope = Submission.needs_grading
                        .where(assignments: { context_type: "Course", context_id: entry.course.id, workflow_state: "published" })
                        .where(user_id: entry.student_ids)
                        .preload(:assignment, :user)
                        .reorder("submissions.submitted_at ASC NULLS LAST, submissions.id ASC")
                        .limit(SCAN_CAP + 1)
      scope = scope.where(user_id: @student_id) if @student_id.present?
      scope.to_a
    end

    def build_row(submission, course, item, tier, anonymous)
      assignment = submission.assignment
      name = anonymous ? ANONYMOUS : submission.user.name
      {
        id: submission.id.to_s,
        tier:,
        reason: reason(tier, name, submission),
        student: anonymous ? { id: nil, name: ANONYMOUS } : { id: submission.user_id.to_s, name: },
        course: { id: course.id.to_s, name: course.name },
        unit: item && { id: item.unit_id.to_s, name: item.unit_name },
        item: { id: assignment.id.to_s, title: assignment.title },
        submitted_at: submission.submitted_at&.iso8601,
        due_at: submission.cached_due_date&.iso8601,
        speed_grader_url: speed_grader_url(course, assignment, submission, anonymous)
      }
    end

    def speed_grader_url(course, assignment, submission, anonymous)
      who = anonymous ? "anonymous_id=#{submission.anonymous_id}" : "student_id=#{submission.user_id}"
      "/courses/#{course.id}/gradebook/speed_grader?assignment_id=#{assignment.id}&#{who}"
    end

    def reason(tier, name, submission)
      case tier
      when Tiering::BLOCKED
        I18n.t("%{student} is waiting on this to move on", student: name)
      when Tiering::COULD_RELOCK
        I18n.t("%{student} moved on with a provisional pass; a failing grade would lock them again", student: name)
      when Tiering::DUE_SOON
        I18n.t("Due %{when}", when: I18n.l(submission.cached_due_date, format: :short))
      else
        days = submission.submitted_at ? ((@now - submission.submitted_at) / 1.day).floor : 0
        I18n.t({ one: "Waiting 1 day", other: "Waiting %{count} days" }, count: days)
      end
    end
  end
end
