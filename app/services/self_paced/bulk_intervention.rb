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

# Bulk interventions (docs/fork-plan.md §2.5): the same SelfPaced::Intervener
# run for each selected student, inside a Progress job. One student failing
# (no permission, nothing to reset, ...) doesn't stop the rest; failures are
# listed in the Progress results.
#
# An item action can name one item (every target in its course) or
# "current": each student's current item, from the dashboard's read model.
module SelfPaced
  module BulkIntervention
    MAX_TARGETS = 500

    # Kinds that make sense for many students at once.
    KINDS = %w[message note extra_attempts reset_attempt unlock mark_complete exempt adjust_target].freeze

    class << self
      # +targets+ is [{course_id:, student_id:}, ...]. Returns the Progress.
      def start(actor:, real_actor:, kind:, targets:, options: {})
        progress = Progress.create!(context: actor, tag: "self_paced_bulk_intervention", user: actor)
        progress.process_job(self,
                             :run,
                             { priority: Delayed::HIGH_PRIORITY },
                             actor.id,
                             real_actor&.id,
                             kind,
                             targets.map { |t| { "course_id" => t[:course_id].to_s, "student_id" => t[:student_id].to_s } },
                             options.stringify_keys)
        progress
      end

      def run(progress, actor_id, real_actor_id, kind, targets, options)
        actor = User.find(actor_id)
        real_actor = real_actor_id && User.find_by(id: real_actor_id)
        courses = Course.where(id: targets.pluck("course_id").uniq).index_by { |c| c.id.to_s }
        students = User.where(id: targets.pluck("student_id").uniq).index_by { |u| u.id.to_s }
        interveners = {}
        failed = []
        done = 0

        targets.each_with_index do |target, index|
          course = courses[target["course_id"]]
          student = students[target["student_id"]]
          begin
            raise Intervener::Invalid, "not found" unless course && student

            intervener = interveners[course.id] ||= Intervener.new(course, actor, real_actor:, progress:)
            intervener.perform(kind, student:, content_tag: tag_for(options["content_tag_id"], course, student), **perform_options(options))
            done += 1
          rescue Intervener::Invalid, Intervener::Denied => e
            failed << { course_id: target["course_id"], student_id: target["student_id"], name: student&.name, error: e.message }
          end
          progress.calculate_completion!(index + 1, targets.size)
        end

        progress.set_results({ "done" => done, "failed" => failed.map(&:stringify_keys) })
      end

      private

      def tag_for(value, course, student)
        return nil if value.blank?
        return value unless value.to_s == "current"

        StudentCourseState.find_by(course:, user: student)&.current_content_tag_id
      end

      def perform_options(options)
        options.slice("reason", "attempts", "body", "subject", "target_date", "reset").symbolize_keys
      end
    end
  end
end
