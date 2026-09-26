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

# The Skills page's data (docs/fork-plan.md): a course's learning outcomes,
# called skills, with how far each student has got on each one. A student's
# level on a skill comes from their latest result, the same "latest attempt
# counts" rule the Course Player uses for checks:
#
# - mastered: the result met the outcome's mastery score
# - almost: at least ALMOST of the mastery score
# - building: some score, less than that
# - not_assessed: no result yet
module SelfPaced
  class Skills
    ALMOST = 0.75
    LEVELS = %w[mastered almost building not_assessed].freeze
    DEFAULT_RATINGS = [
      { points: 4, description: "Exceeds Mastery" },
      { points: 3, description: "Meets Mastery" },
      { points: 2, description: "Near Mastery" },
      { points: 1, description: "Below Mastery" },
      { points: 0, description: "No Evidence" }
    ].freeze

    def initialize(course)
      @course = course
    end

    def as_json
      list = skills
      {
        course: { id: @course.id.to_s, name: @course.name },
        students: students.size,
        skills: list,
        summary: summary(list)
      }
    end

    # Makes a course skill with the standard four-level scale and links it
    # into the course.
    def create!(title:, description: nil, mastery_points: 3)
      outcome = LearningOutcome.new(context: @course, title: title.to_s.strip, description: description.to_s.strip.presence)
      outcome.rubric_criterion = { mastery_points:, points_possible: 4, ratings: DEFAULT_RATINGS }
      outcome.save!
      @course.root_outcome_group.add_outcome(outcome)
      outcome
    end

    def level_for(result, outcome)
      return "not_assessed" unless result&.score
      return "mastered" if result.mastery

      mastery = outcome.mastery_points.to_f
      (mastery.positive? && result.score.to_f / mastery >= ALMOST) ? "almost" : "building"
    end

    private

    def students
      @students ||= @course.student_enrollments.active.preload(:user).map(&:user).uniq.sort_by { |user| user.sortable_name.to_s }
    end

    def outcomes
      @outcomes ||= begin
        ids = @course.learning_outcome_links.active.where(content_type: "LearningOutcome").pluck(:content_id)
        LearningOutcome.active.where(id: ids).order(:short_description, :id).to_a
      end
    end

    # {[user_id, outcome_id] => the latest result}
    def latest_results
      @latest_results ||= LearningOutcomeResult.where(context: @course, learning_outcome_id: outcomes.map(&:id), user_id: students.map(&:id))
                                               .where(workflow_state: "active")
                                               .where.not(score: nil)
                                               .order(Arel.sql("COALESCE(assessed_at, created_at)"), :id)
                                               .index_by { |result| [result.user_id, result.learning_outcome_id] }
    end

    def skills
      alignments = alignments_by_outcome
      lessons = lessons_by_outcome
      tested_out = TestOut.tested_out_counts(@course)
      outcomes.map do |outcome|
        rows = students.map { |student| student_row(student, outcome) }
        {
          id: outcome.id.to_s,
          title: outcome.title,
          description: ActionController::Base.helpers.strip_tags(outcome.description.to_s).squish.truncate(240).presence,
          mastery_points: outcome.mastery_points,
          counts: LEVELS.index_with { |level| rows.count { |row| row[:level] == level } },
          aligned: alignments[outcome.id] || [],
          lessons: lessons[outcome.id] || [],
          tested_out: tested_out.fetch(outcome.id, 0),
          students: rows.sort_by { |row| [priority(row[:level]), row[:name]] }
        }
      end
    end

    def student_row(student, outcome)
      result = latest_results[[student.id, outcome.id]]
      {
        id: student.id.to_s,
        name: student.name,
        level: level_for(result, outcome),
        score: result&.score,
        assessed_at: (result&.assessed_at || result&.created_at)&.iso8601
      }
    end

    # Who to look at first: building, almost, not assessed, then mastered.
    def priority(level)
      %w[building almost not_assessed mastered].index(level)
    end

    def alignments_by_outcome
      tags = ContentTag.where(tag_type: "learning_outcome", learning_outcome_id: outcomes.map(&:id), context: @course)
                       .where.not(workflow_state: "deleted").preload(:content)
      tags.group_by(&:learning_outcome_id).transform_values do |list|
        list.filter_map do |tag|
          content = tag.content
          next unless content

          { id: tag.id.to_s, title: content.try(:title) || content.try(:name), type: tag.content_type, url: alignment_url(tag) }
        end.uniq { |item| [item[:type], item[:title]] }
      end
    end

    # {outcome_id => [{id, title}]}: the lessons a student skips once they
    # master the skill (Phase 9).
    def lessons_by_outcome
      ItemSetting.where(course: @course, learning_outcome_id: outcomes.map(&:id)).preload(:content_tag).each_with_object({}) do |setting, result|
        tag = setting.content_tag
        next unless tag&.workflow_state == "active"

        (result[setting.learning_outcome_id] ||= []) << { id: tag.id.to_s, title: tag.title }
      end
    end

    def alignment_url(tag)
      base = "/courses/#{@course.id}"
      case tag.content_type
      when "Assignment" then "#{base}/assignments/#{tag.content_id}"
      when "Rubric" then "#{base}/rubrics/#{tag.content_id}"
      when "Quizzes::Quiz" then "#{base}/quizzes/#{tag.content_id}"
      end
    end

    def summary(list)
      totals = LEVELS.index_with { |level| list.sum { |skill| skill[:counts][level] } }
      assessed = totals.values_at("mastered", "almost", "building").sum
      {
        totals:,
        mastered_percent: assessed.zero? ? nil : (totals["mastered"] * 100.0 / assessed).round,
        needing_attention: list.count { |skill| needs_attention?(skill) }
      }
    end

    # Assessed for someone, and fewer than half of them have mastered it.
    def needs_attention?(skill)
      assessed = skill[:counts].values_at("mastered", "almost", "building").sum
      assessed.positive? && skill[:counts]["mastered"] * 2 < assessed
    end
  end
end
