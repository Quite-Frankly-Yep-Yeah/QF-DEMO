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

# Keeps the progress columns of SelfPaced::StudentCourseState current
# (docs/fork-plan.md §3.5). Model callbacks call .enqueue, which runs a
# debounced refresh for one student in one course; a nightly job rebuilds every
# tracked course to repair anything that was missed.
module SelfPaced
  class StateRefresher
    DEBOUNCE = 30.seconds

    PROGRESS_SQL = <<~SQL.squish
      current_content_tag_id = EXCLUDED.current_content_tag_id,
      attempts_on_current_item = EXCLUDED.attempts_on_current_item,
      requirements_completed = EXCLUDED.requirements_completed,
      requirements_total = EXCLUDED.requirements_total,
      percent_complete = EXCLUDED.percent_complete,
      current_score = EXCLUDED.current_score,
      unposted_current_score = EXCLUDED.unposted_current_score,
      days_behind = EXCLUDED.days_behind,
      target_date = EXCLUDED.target_date,
      expected_percent = EXCLUDED.expected_percent,
      refreshed_at = EXCLUDED.refreshed_at,
      updated_at = EXCLUDED.updated_at
    SQL

    class << self
      # Called from model callbacks, so it has to be cheap when self-paced is
      # off: one cached account lookup before anything else.
      def enqueue(root_account_id:, course_id:, user_id:)
        return unless root_account_id && course_id && user_id
        return unless Account.find_cached(root_account_id)&.feature_enabled?(:self_paced)

        course = Course.find_by(id: course_id)
        return unless course && SelfPaced.feature_enabled?(course, :self_paced_activity_tracking)

        delay(singleton: "self_paced_state:#{course.global_id}:#{Shard.global_id_for(user_id)}",
              run_at: DEBOUNCE.from_now)
          .refresh_by_ids(course.id, user_id)
      end

      def refresh_by_ids(course_id, user_id)
        course = Course.find_by(id: course_id)
        user = User.find_by(id: user_id)
        refresh(course, user) if course && user
      end

      def refresh(course, user)
        course.shard.activate do
          enrollment = course.student_enrollments.active.where(user_id: user).order(:id).first
          unless enrollment
            StudentCourseState.where(course:, user:).delete_all
            next
          end

          StudentCourseState.upsert_all([progress_attributes(course, user, enrollment)],
                                        unique_by: %i[course_id user_id],
                                        on_duplicate: Arel.sql(PROGRESS_SQL),
                                        record_timestamps: false)
        end
      end

      # Nightly: queue a rebuild of every course that has tracked students.
      def rebuild_all
        course_ids = StudentCourseState.distinct.pluck(:course_id)
        Course.where(id: course_ids).find_each do |course|
          delay(n_strand: ["self_paced_rebuild", course.global_root_account_id]).rebuild_course(course)
        end
      end

      # Refresh every active student in +course+, and drop rows for students
      # who are no longer enrolled.
      def rebuild_course(course)
        return unless SelfPaced.feature_enabled?(course, :self_paced_activity_tracking)

        user_ids = course.student_enrollments.active.distinct.pluck(:user_id)
        User.where(id: user_ids).find_each { |user| refresh(course, user) }
        StudentCourseState.where(course:).where.not(user_id: user_ids).delete_all
      end

      private

      def progress_attributes(course, user, enrollment)
        progress = CourseProgress.new(course, user, read_only: true)
        tag = progress.current_content_tag
        score = enrollment.find_score
        now = Time.zone.now

        {
          user_id: user.id,
          course_id: course.id,
          root_account_id: course.root_account_id,
          current_content_tag_id: tag&.id,
          attempts_on_current_item: attempts_on(tag, user),
          requirements_completed: progress.requirement_completed_count,
          requirements_total: progress.requirement_count,
          percent_complete: progress.progress_percent.to_f.round(2),
          current_score: score&.current_score,
          unposted_current_score: score&.unposted_current_score,
          refreshed_at: now,
          created_at: now,
          updated_at: now
        }.merge(pacing_attributes(course, user))
      end

      # Makes or re-spreads the student's pacing plan (at most once a day) and
      # reads where they stand against it.
      def pacing_attributes(course, user)
        return { days_behind: nil, target_date: nil, expected_percent: nil } unless Pacer.course?(course)

        pacer = Pacer.new(course, user)
        pacer.refresh!
        pacer.state_attributes
      end

      # Attempts made on the item the student is stuck on. The item is only
      # "current" while its requirement is unmet, so these are failed or
      # ungraded attempts.
      def attempts_on(tag, user)
        tag&.assignment&.submissions&.where(user_id: user)&.pick(:attempt).to_i
      end
    end
  end
end
