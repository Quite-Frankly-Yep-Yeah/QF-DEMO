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
  #
  # Every waiting submission is ranked on a few columns first, so the cap of
  # SCAN_CAP rows cuts by the queue's own order and never hides held-up work.
  # Full rows are only built for the page being shown.
  class GradingQueue
    SCAN_CAP = 500
    PER_PAGE = 25
    CACHE_FOR = 60.seconds
    ANONYMOUS = "Anonymous student"
    # Waiting submissions read per course before giving up (a safety valve).
    HARD_LIMIT = 20_000
    FAR_FUTURE = Time.utc(9999)

    Candidate = Struct.new(:submission_id,
                           :user_id,
                           :assignment_id,
                           :course,
                           :item,
                           :tier,
                           :anonymous,
                           :submitted_at,
                           :due_at,
                           keyword_init: true)

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
      entries = Courses.for(@viewer, extra_course_id: @course_id)
      all = entries.flat_map { |entry| candidates_for(entry) }
      facets = facets_for(all)
      candidates = filter(all).sort_by { |c| [c.tier, c.submitted_at || FAR_FUTURE, c.submission_id] }
      tier_counts = (1..4).index_with { |tier| candidates.count { |c| c.tier == tier } }
      candidates = candidates.select { |c| c.tier <= Tiering::COULD_RELOCK } if @held_up
      truncated = candidates.size > SCAN_CAP || !!@scan_truncated
      candidates = candidates.first(SCAN_CAP)
      {
        rows: build_rows(candidates.slice((@page - 1) * PER_PAGE, PER_PAGE) || []),
        page: @page,
        per_page: PER_PAGE,
        total: candidates.size,
        truncated:,
        tier_counts:,
        turnaround: GradingTurnaround.for(@viewer, entries.map { |entry| entry.course.id }, now: @now).transform_keys(&:to_s),
        facets:
      }
    end

    # One Candidate per waiting submission in the course, from a handful of
    # columns, with its tier decided.
    def candidates_for(entry)
      course = entry.course
      index = ItemIndex.new(course)
      player = SelfPaced::Gating.player_course?(course)
      provisional = SelfPaced::Gating.provisional?(course)
      rows = waiting(entry)
      @scan_truncated ||= rows.size > HARD_LIMIT
      rows = rows.first(HARD_LIMIT)
      assignments = Assignment.where(id: rows.map { |row| row[2] }.uniq).index_by(&:id)
      states = SelfPaced::StudentCourseState.where(course:, user_id: rows.map { |row| row[1] }.uniq).index_by(&:user_id)

      rows.map do |id, user_id, assignment_id, submitted_at, due_at|
        assignment = assignments[assignment_id]
        item = index.for_assignment(assignment)
        # On anonymous work the student must not show through the tier or the
        # due date: both describe one student, and the Students page names them.
        anonymous = assignment.anonymize_students?
        current = states[user_id]&.current_content_tag_id&.then { |tag_id| index.for_tag_id(tag_id) }
        tier = if anonymous
                 Tiering::OTHER
               else
                 Tiering.call(due_at:, item:, current_item: current, player:, provisional:, now: @now)
               end
        Candidate.new(submission_id: id,
                      user_id:,
                      assignment_id:,
                      course:,
                      item:,
                      tier:,
                      anonymous:,
                      submitted_at:,
                      due_at: anonymous ? nil : due_at)
      end
    end

    def waiting(entry)
      Submission.needs_grading
                .where(assignments: { context_type: "Course", context_id: entry.course.id, workflow_state: "published" })
                .where(user_id: entry.student_ids)
                .limit(HARD_LIMIT + 1)
                .pluck("submissions.id",
                       "submissions.user_id",
                       "submissions.assignment_id",
                       "submissions.submitted_at",
                       "submissions.cached_due_date")
    end

    def filter(candidates)
      candidates.select do |c|
        (@course_id.blank? || c.course.id == @course_id.to_i) &&
          (@unit_id.blank? || c.item&.unit_id == @unit_id.to_i) &&
          (@student_id.blank? || (!c.anonymous && c.user_id == @student_id.to_i))
      end
    end

    # What the page can filter by, from everything waiting. Anonymous students
    # are left out so the list can't name them.
    def facets_for(candidates)
      names = User.where(id: candidates.reject(&:anonymous).map(&:user_id).uniq).pluck(:id, :name).to_h
      {
        courses: candidates.map(&:course).uniq.map { |course| { id: course.id.to_s, name: course.name } },
        units: candidates.filter_map { |c| c.item && [c.item, c.course] }.uniq { |item, _| item.unit_id }
                         .map { |item, course| { id: item.unit_id.to_s, name: item.unit_name, course_id: course.id.to_s } },
        students: names.map { |id, name| { id: id.to_s, name: } }.sort_by { |student| student[:name] }
      }
    end

    def build_rows(candidates)
      submissions = Submission.where(id: candidates.map(&:submission_id)).preload(:assignment, :user).index_by(&:id)
      candidates.map { |candidate| build_row(candidate, submissions.fetch(candidate.submission_id)) }
    end

    def build_row(candidate, submission)
      assignment = submission.assignment
      course = candidate.course
      item = candidate.item
      name = candidate.anonymous ? ANONYMOUS : submission.user.name
      {
        id: submission.id.to_s,
        tier: candidate.tier,
        reason: reason(candidate, name),
        student: candidate.anonymous ? { id: nil, name: ANONYMOUS } : { id: submission.user_id.to_s, name: },
        course: { id: course.id.to_s, name: course.name },
        unit: item && { id: item.unit_id.to_s, name: item.unit_name },
        item: { id: assignment.id.to_s, title: assignment.title },
        submitted_at: candidate.submitted_at&.iso8601,
        due_at: candidate.due_at&.iso8601,
        speed_grader_url: speed_grader_url(course, assignment, submission, candidate.anonymous)
      }
    end

    def speed_grader_url(course, assignment, submission, anonymous)
      who = anonymous ? "anonymous_id=#{submission.anonymous_id}" : "student_id=#{submission.user_id}"
      "/courses/#{course.id}/gradebook/speed_grader?assignment_id=#{assignment.id}&#{who}"
    end

    def reason(candidate, name)
      case candidate.tier
      when Tiering::BLOCKED
        I18n.t("%{student} is waiting on this to move on", student: name)
      when Tiering::COULD_RELOCK
        I18n.t("%{student} moved on with a provisional pass; a failing grade would lock them again", student: name)
      when Tiering::DUE_SOON
        I18n.t("Due %{when}", when: I18n.l(candidate.due_at, format: :short))
      else
        days = candidate.submitted_at ? ((@now - candidate.submitted_at) / 1.day).floor : 0
        I18n.t({ one: "Waiting 1 day", other: "Waiting %{count} days" }, count: days)
      end
    end
  end
end
