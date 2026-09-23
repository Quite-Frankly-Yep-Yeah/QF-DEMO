# frozen_string_literal: true

#
# Copyright (C) 2026 - present EXAMPLE contributors
#
# This file is part of EXAMPLE LMS, a modified version of Canvas.
#
# EXAMPLE LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

# The course player's setup (docs/fork-plan.md §2.1): per-item roles and
# rules, turned into native module settings so Canvas enforces the gating
# everywhere (direct links, the API, quiz eligibility).
#
# For every module:
# - items unlock in order (require_sequential_progress)
# - the module requires the one before it (prerequisites)
# - instruction  -> must_view, or must_watch for videos
# - practice     -> must_submit
# - check/pretest-> min_percentage at the item's or the course's threshold
# - none         -> no requirement
# Graded checks score by the latest attempt (so a lower retake can re-lock,
# decision 6) and take the configured number of attempts.
module SelfPaced
  class CourseSetup
    DEFAULT_THRESHOLD = 70.0

    attr_reader :course

    def initialize(course)
      @course = course
    end

    def mastery_threshold
      value = course.self_paced_mastery_threshold.to_f
      value.positive? ? value : DEFAULT_THRESHOLD
    end

    def as_json
      {
        mastery_threshold:,
        provisional_checks: course.self_paced_provisional_checks,
        modules: modules.map do |mod|
          {
            id: mod.id.to_s,
            name: mod.name,
            items: items_for(mod).map { |tag, setting| item_json(mod, tag, setting) }
          }
        end
      }
    end

    # params: { mastery_threshold:, provisional_checks:, items: [{ id:, role:, estimated_minutes:,
    #           mastery_threshold:, watch_fraction:, max_attempts:, retake_review: }] }
    def apply!(params)
      params = params.to_h.with_indifferent_access
      Course.transaction do
        course.self_paced_mastery_threshold = params[:mastery_threshold] if params.key?(:mastery_threshold)
        course.self_paced_provisional_checks = params[:provisional_checks] if params.key?(:provisional_checks)
        course.save!
        Array(params[:items]).each { |item| save_item_setting!(item.with_indifferent_access) }
        write_module_settings!
      end
      self
    end

    # Rewrites every module's native settings from the saved item settings.
    def write_module_settings!
      previous = nil
      modules.each do |mod|
        requirements = items_for(mod).filter_map { |tag, setting| requirement_for(tag, setting) }
        mod.completion_requirements = requirements
        mod.requirement_count = nil
        mod.require_sequential_progress = true
        mod.prerequisites = previous ? "module_#{previous.id}" : ""
        mod.save!
        items_for(mod).each { |tag, setting| configure_attempts!(tag, setting) }
        previous = mod
      end
    end

    def requirement_for(tag, setting)
      case setting.role
      when "instruction"
        { id: tag.id, type: setting.watch_fraction ? "must_watch" : "must_view" }
      when "practice"
        { id: tag.id, type: tag.scoreable? ? "must_submit" : "must_view" }
      when "check", "pretest"
        if tag.scoreable? && tag.assignment&.points_possible.to_f.positive?
          { id: tag.id, type: "min_percentage", min_percentage: setting.mastery_threshold || mastery_threshold }
        else
          { id: tag.id, type: tag.scoreable? ? "must_submit" : "must_view" }
        end
      end
    end

    private

    def modules
      @modules ||= course.context_modules.not_deleted.order(:position, :id).to_a
    end

    def items_for(mod)
      @items ||= {}
      @items[mod.id] ||= begin
        tags = mod.content_tags.not_deleted.order(:position, :id).to_a
        settings = ItemSetting.where(content_tag_id: tags.map(&:id)).index_by(&:content_tag_id)
        tags.map { |tag| [tag, settings[tag.id] || ItemSetting.new(content_tag: tag, course:, role: ItemSetting.suggested_role(tag))] }
      end
    end

    def item_json(mod, tag, setting)
      requirement = mod.completion_requirements.to_a.find { |req| req[:id] == tag.id }
      {
        id: tag.id.to_s,
        title: tag.title,
        type: tag.content_type,
        scoreable: tag.scoreable?,
        role: setting.role,
        estimated_minutes: setting.estimated_minutes,
        mastery_threshold: setting.mastery_threshold,
        watch_fraction: setting.watch_fraction,
        max_attempts: setting.max_attempts,
        retake_review: setting.retake_review,
        requirement: requirement&.slice(:type, :min_percentage, :min_score)
      }
    end

    def save_item_setting!(item)
      tag = course.context_module_tags.not_deleted.find_by(id: item[:id])
      return unless tag

      setting = ItemSetting.find_or_initialize_by(content_tag: tag) { |s| s.course = course }
      setting.assign_attributes(item.slice(:role, :estimated_minutes, :mastery_threshold, :watch_fraction, :max_attempts, :retake_review)
                                    .transform_values(&:presence)
                                    .merge(retake_review: ActiveModel::Type::Boolean.new.cast(item[:retake_review]) || false))
      setting.role ||= ItemSetting.suggested_role(tag)
      setting.save!
      @items = nil
    end

    # Graded checks score by the latest attempt and take the configured number
    # of attempts. Only Classic Quizzes and plain assignments are touched.
    def configure_attempts!(tag, setting)
      return unless %w[check pretest].include?(setting.role)

      case (content = tag.content)
      when Quizzes::Quiz
        content.scoring_policy = "keep_latest"
        content.allowed_attempts = setting.max_attempts if setting.max_attempts
        content.save! if content.changed?
      when Assignment
        if setting.max_attempts && content.allowed_attempts != setting.max_attempts
          content.update!(allowed_attempts: setting.max_attempts)
        end
      end
    end
  end
end
