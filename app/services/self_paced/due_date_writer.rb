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

# Writes a student's current pacing plan onto their graded items as their own
# due dates (docs/fork-plan.md §2.3, decision 1), the way Course Pacing
# publishes: ADHOC assignment overrides, one per assignment and date, shared
# by every student due that day.
#
# Rules:
# - dates are written for the next HORIZON school days only (plus items that
#   already have one), so a re-spread moves a handful of dates instead of the
#   whole course; later items get theirs as they come into the window;
# - only dates that changed are written;
# - submitted (or graded, or excused) items keep their date;
# - a date that has already passed stays, so "missing" means behind pace;
# - a teacher's date wins: an ADHOC override that isn't ours, a section or
#   group override with a due date, or our override after a teacher edited it.
module SelfPaced
  class DueDateWriter
    OVERRIDE_TITLE = "Self-paced plan"
    # Two school weeks.
    HORIZON = 10

    def self.write_later(course, user)
      delay(singleton: "self_paced_due_dates:#{course.global_id}:#{user.global_id}",
            n_strand: ["self_paced_due_dates", course.global_root_account_id])
        .write_by_ids(course.id, user.id)
    end

    def self.write_by_ids(course_id, user_id)
      course = Course.find_by(id: course_id)
      user = User.find_by(id: user_id)
      new(course, user).write! if course && user
    end

    def initialize(course, user, now: Time.zone.now)
      @course = course
      @user = user
      @now = now
    end

    # Returns the assignments whose date changed.
    def write!
      return [] unless Pacer.course?(@course)

      plan = PacingPlan.find_by(course: @course, user: @user)
      return [] unless plan

      planned = planned_due_dates(plan)
      return [] if planned.empty?

      assignments = @course.assignments.active.where(id: planned.keys).to_a
      skip = submitted_ids(planned.keys) | teacher_dated_ids(planned.keys)
      links = AssignmentOverrideStudent.active.where(user_id: @user.id, assignment_id: planned.keys)
                                       .preload(:assignment_override).index_by(&:assignment_id)
      written = plan.written_due_dates.dup
      changed = []

      Assignment.suspend_due_date_caching do
        assignments.each do |assignment|
          next if assignment.only_visible_to_overrides || skip.include?(assignment.id)

          due_at = planned[assignment.id]
          link = links[assignment.id]
          next unless writable?(link, written[assignment.id.to_s], due_at)

          move_student(assignment, link, due_at)
          written[assignment.id.to_s] = due_at.iso8601
          changed << assignment
        end
      end

      plan.update_column(:written_due_dates, written) if written != plan.written_due_dates
      if changed.any?
        Assignment.clear_cache_keys(changed, :availability)
        SubmissionLifecycleManager.recompute_users_for_course([@user.id], @course, changed.map(&:id), update_grades: true)
      end
      changed
    end

    private

    # {assignment_id => due_at}: the end of each graded item's planned day in
    # the course's time zone, for items inside the horizon or already dated.
    def planned_due_dates(plan)
      pacer = Pacer.new(@course, @user)
      estimates = pacer.item_estimates
      zone = @course.time_zone
      horizon_end = horizon_end(pacer.calendar)
      plan.planned_dates.each_with_object({}) do |(tag_id, date), result|
        assignment_id = estimates[tag_id]&.last
        next unless assignment_id
        next unless date <= horizon_end || plan.written_due_dates.key?(assignment_id.to_s)

        result[assignment_id] = CanvasTime.fancy_midnight(zone.local(date.year, date.month, date.day)).utc
      end
    end

    def horizon_end(calendar)
      today = @now.in_time_zone(@course.time_zone).to_date
      days = calendar.instructional_days(today, today + (HORIZON * 3))
      days.first(HORIZON).last&.first || (today + HORIZON)
    end

    def writable?(link, written_at, due_at)
      return true unless link

      override = link.assignment_override
      return false unless override&.active? && override.title == OVERRIDE_TITLE
      return false if written_at && override.due_at && (override.due_at - Time.zone.parse(written_at)).abs > 1 # a teacher changed it
      return false if override.due_at && override.due_at < @now # already due

      !(override.due_at && (override.due_at - due_at).abs < 1)
    end

    def move_student(assignment, link, due_at)
      target = assignment.assignment_overrides.active.find_by(set_type: "ADHOC",
                                                              title: OVERRIDE_TITLE,
                                                              due_at_overridden: true,
                                                              due_at: (due_at - 1.second)..(due_at + 1.second))
      target ||= assignment.assignment_overrides.create!(title: OVERRIDE_TITLE, set_type: "ADHOC", due_at_overridden: true, due_at:)
      if link
        previous = link.assignment_override
        link.update!(assignment_override: target)
        previous.destroy_if_empty_set
      else
        target.assignment_override_students.create!(user: @user, no_enrollment: false)
      end
    end

    def submitted_ids(assignment_ids)
      Submission.active.where(user_id: @user.id, assignment_id: assignment_ids)
                .where("submitted_at IS NOT NULL OR score IS NOT NULL OR excused")
                .pluck(:assignment_id).to_set
    end

    # Assignments where a section or group override gives this student a date.
    def teacher_dated_ids(assignment_ids)
      section_ids = @course.student_enrollments.active.where(user_id: @user.id).pluck(:course_section_id)
      group_ids = GroupMembership.active.where(user_id: @user.id)
                                 .joins(:group).where(groups: { context_type: "Course", context_id: @course.id })
                                 .pluck(:group_id)
      scope = AssignmentOverride.active.where(assignment_id: assignment_ids, due_at_overridden: true)
      scope.where(set_type: "CourseSection", set_id: section_ids)
           .or(scope.where(set_type: "Group", set_id: group_ids))
           .pluck(:assignment_id).to_set
    end
  end
end
