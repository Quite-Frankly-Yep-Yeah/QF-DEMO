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

# The course map the student course player shows (docs/fork-plan.md §2.4):
# every unit and item in order, with what the student has done, what they're
# on, and what is still locked. The same data drives the map page and the
# player bar's previous/next buttons.
module SelfPaced
  class PlayerMap
    def initialize(course, user)
      @course = course
      @user = user
    end

    def as_json
      progress = CourseProgress.new(@course, @user)
      current_id = progress.current_content_tag&.id
      units = modules.map { |mod| unit_json(mod, current_id) }
      items = units.flat_map { |unit| unit[:items] }.reject { |item| item[:type] == "header" }

      {
        course: { id: @course.id.to_s, name: @course.name },
        percent_complete: progress.progress_percent.to_f.round,
        requirements_completed: progress.requirement_completed_count,
        requirements_total: progress.requirement_count,
        current_item: (items.find { |i| i[:status] == "current" } || items.find { |i| i[:status] == "available" })&.slice(:id, :title, :url),
        units:
      }
    end

    private

    def admin?
      @admin ||= @course.grants_right?(@user, :read_as_admin)
    end

    def modules
      @course.modules_visible_to(@user).active.order(:position, :id).to_a
    end

    def settings
      @settings ||= ItemSetting.where(course: @course).index_by(&:content_tag_id)
    end

    def unit_json(mod, current_id)
      progression = admin? ? nil : mod.evaluate_for(@user)
      requirements = mod.completion_requirements.to_a.index_by { |req| req[:id] }
      met = (progression&.requirements_met || []).to_set { |req| req[:id] }
      items = mod.content_tags_visible_to(@user).map do |tag|
        if tag.content_type == "ContextModuleSubHeader"
          { id: tag.id.to_s, title: tag.title, type: "header" }
        else
          item_json(mod, tag, requirements[tag.id], progression, met, current_id)
        end
      end
      { id: mod.id.to_s, name: mod.name, state: progression&.workflow_state || "unlocked", items: }
    end

    def item_json(mod, tag, requirement, progression, met, current_id)
      setting = settings[tag.id]
      {
        id: tag.id.to_s,
        title: tag.title,
        type: tag.content_type,
        url: Rails.application.routes.url_helpers.course_context_modules_item_redirect_path(course_id: @course.id, id: tag.id),
        role: setting&.role || ItemSetting.suggested_role(tag),
        estimated_minutes: setting&.estimated_minutes,
        requirement: requirement&.slice(:type, :min_percentage, :min_score),
        status: status(mod, tag, progression, met, current_id),
        tested_out: tested_out_ids.include?(tag.id),
        planned_date: planned_dates[tag.id]&.iso8601
      }
    end

    # Items skipped because the student mastered the skill they teach (Phase 9).
    def tested_out_ids
      @tested_out_ids ||= @user ? ItemOverride.active.where(user: @user, course: @course, kind: "exempt").where.not(learning_outcome_id: nil).pluck(:content_tag_id).to_set : Set.new
    end

    # The student's current pacing plan, when the course is paced.
    def planned_dates
      return @planned_dates if defined?(@planned_dates)

      @planned_dates = (Pacer.course?(@course) && @user && PacingPlan.find_by(course: @course, user: @user)&.planned_dates) || {}
    end

    def status(mod, tag, progression, met, current_id)
      return "available" if admin?
      return "completed" if met.include?(tag.id) || ItemOverride.meets_requirement?(@user.id, @course, tag.id)
      return "current" if tag.id == current_id
      return "locked" if progression && !mod.available_for_progression?(tag, progression)

      "available"
    end
  end
end
