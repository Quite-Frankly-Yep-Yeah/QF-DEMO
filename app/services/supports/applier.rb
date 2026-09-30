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

# Accommodations that act (docs/teacher-workflow-plan.md §2.3, Phase 2).
#
# Quiz time and attempts are applied when an attempt starts
# (Supports::QuizAccommodations) and pacing whenever the plan is spread
# (Supports::PacingAccommodation). When a student's accommodations change,
# #sync_later brings what already exists up to date: extra attempts on quizzes
# they have taken, their pacing plans, and display settings, which are turned
# on once and then left to the student.
module Supports
  module Applier
    FLAG = :supports_accommodations_apply

    class << self
      def course_enabled?(course)
        course.is_a?(Course) && Supports.feature_enabled?(course, FLAG)
      end

      # The student's accommodations of +kinds+ in effect today in +course+.
      def current(student, course, kinds)
        return [] unless student.is_a?(User) && !student.new_record? && course_enabled?(course)

        RequestCache.cache("supports_current_accommodations", student.id, course.id, Array(kinds).sort) do
          StudentAccommodation.current
                              .where(student_id: student.id, root_account_id: course.root_account_id)
                              .joins(:accommodation_type).where(accommodation_types: { kind: kinds })
                              .where("student_accommodations.course_ids = '{}' OR ? = ANY(student_accommodations.course_ids)", course.id)
                              .preload(:accommodation_type)
                              .order(:id)
                              .to_a
        end
      end

      # StudentAccommodation and Plan after_commit. Cheap when supports are off.
      def sync_later(student_id, root_account)
        return unless student_id && root_account && Supports.enabled?(root_account)

        delay(singleton: "supports_apply:#{root_account.global_id}:#{student_id}", run_at: 10.seconds.from_now)
          .sync(student_id, root_account.id)
      end

      def sync(student_id, root_account_id)
        student = User.find_by(id: student_id)
        root_account = Account.find_by(id: root_account_id)
        return unless student && root_account && Supports.enabled?(root_account)

        courses(student, root_account).each do |course|
          next unless course_enabled?(course)

          QuizAccommodations.sync(student, course)
          SelfPaced::Pacer.new(course, student).refresh!(force: true) if SelfPaced::Pacer.course?(course)
        end
        apply_display_settings(student, root_account)
      end

      # Daily: accommodations whose start date is today act on existing work.
      def sync_starting_today
        StudentAccommodation.active.where(start_date: Time.zone.today).distinct
                            .pluck(:student_id, :root_account_id).each do |student_id, root_account_id|
          root_account = Account.find_by(id: root_account_id)
          sync_later(student_id, root_account) if root_account
        end
      end

      private

      def courses(student, root_account)
        Course.where(id: Enrollment.where(user_id: student.id,
                                          type: "StudentEnrollment",
                                          workflow_state: "active",
                                          root_account_id: root_account.id)
                         .select(:course_id)).to_a
      end

      # Turns a display setting on the first time the accommodation is in
      # effect. The student can turn it off again, and it is not turned back on.
      def apply_display_settings(student, root_account)
        rows = StudentAccommodation.current.where(student_id: student.id, root_account_id: root_account.id)
                                   .joins(:accommodation_type).where(accommodation_types: { kind: "display" })
                                   .preload(:plan).to_a
        rows.each do |accommodation|
          next unless Supports.feature_enabled?(accommodation.plan.account, FLAG)
          next if Application.where(student_accommodation: accommodation, kind: "display").exists?

          setting = accommodation.parameters["setting"]
          next unless AccommodationType::DISPLAY_SETTINGS.include?(setting)

          was_on = !!student.feature_enabled?(setting.to_sym)
          student.enable_feature!(setting.to_sym) unless was_on
          Application.record!(accommodation,
                              kind: "display",
                              context: student,
                              details: { setting:, already_on: was_on })
        end
      end
    end
  end
end
