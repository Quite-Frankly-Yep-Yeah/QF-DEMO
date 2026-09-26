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

# What the staff home of a self-paced course shows (/courses/:id for teachers,
# TAs and admins): setup progress, the units, the class at a glance and the
# places they go next. Reads the dashboard read model, so it stays cheap.
module SelfPaced
  class StaffHome
    STUCK_TRIES = 3
    BEHIND_DAYS = 3
    INACTIVE_DAYS = 3

    def initialize(course, user, now: Time.zone.now)
      @course = course
      @user = user
      @now = now
    end

    def as_json
      {
        course: course_json,
        checklist:,
        units:,
        stats:,
        links:
      }
    end

    private

    def can?(right)
      @course.grants_right?(@user, right)
    end

    def course_json
      {
        id: @course.id.to_s,
        name: @course.name,
        course_code: @course.course_code,
        published: @course.available?,
        color: @course.course_color.presence
      }
    end

    def modules
      @modules ||= @course.context_modules.not_deleted.order(:position, :id).preload(:content_tags).to_a
    end

    def visible_items(context_module)
      context_module.content_tags.select { |tag| tag.workflow_state != "deleted" && tag.content_type != "ContextModuleSubHeader" }
    end

    def units
      modules.map do |context_module|
        items = visible_items(context_module)
        {
          id: context_module.id.to_s,
          name: context_module.name,
          published: context_module.active?,
          items: items.size,
          quizzes: items.count { |tag| tag.content_type == "Quizzes::Quiz" },
          unpublished_items: items.count { |tag| tag.workflow_state == "unpublished" },
          url: "#{course_context_modules_path}#module_#{context_module.id}"
        }
      end
    end

    def item_count
      @item_count ||= modules.sum { |context_module| visible_items(context_module).size }
    end

    def student_count
      @student_count ||= @course.student_enrollments.active.distinct.count(:user_id)
    end

    # The steps to get a class ready, each with whether it's done and where
    # to do it. Only steps the viewer can do are listed.
    def checklist
      steps = []
      steps << step("units", I18n.t("Add units and items"), modules.any? && item_count.positive?, course_context_modules_path) if can?(:manage_course_content_edit)
      steps << step("estimates", I18n.t("Say how long each item takes"), estimates_set?, setup_path) if can?(:manage_course_content_edit)
      steps << step("students", I18n.t("Add students"), student_count.positive?, course_users_path) if can?(:read_roster)
      steps << step("publish", I18n.t("Publish the course"), @course.available?, course_settings_path) if can?(:update)
      steps
    end

    def step(id, label, done, url)
      { id:, label:, done: !!done, url: }
    end

    def estimates_set?
      tag_ids = modules.flat_map { |context_module| visible_items(context_module).map(&:id) }
      return false if tag_ids.empty?

      ItemSetting.where(content_tag_id: tag_ids).where.not(estimated_minutes: nil).exists?
    end

    def stats
      states = StudentCourseState.where(course: @course).to_a
      return nil if states.empty? && student_count.zero?

      cutoff = @now - INACTIVE_DAYS.days
      {
        students: student_count,
        tracked: states.size,
        average_percent: states.empty? ? 0 : (states.sum { |s| s.percent_complete.to_f } / states.size).round,
        behind: states.count { |s| s.days_behind.to_i >= BEHIND_DAYS },
        stuck: states.count { |s| s.attempts_on_current_item.to_i >= STUCK_TRIES },
        inactive: states.count { |s| (s.last_active_at || s.created_at) < cutoff }
      }
    end

    def course_context_modules_path
      helpers.course_context_modules_path(@course)
    end

    def course_users_path
      helpers.course_users_path(@course)
    end

    def course_settings_path
      helpers.course_settings_path(@course)
    end

    def setup_path
      "/courses/#{@course.id}/player_setup"
    end

    def helpers
      Rails.application.routes.url_helpers
    end

    # Grouped by what the teacher is doing; only what they may do.
    def links
      h = helpers
      make = []
      make << { id: "quiz", label: I18n.t("New quiz"), url: "#{h.course_quizzes_path(@course)}/new" } if can?(:manage_assignments_add)
      make << { id: "assignment", label: I18n.t("New assignment"), url: "#{h.course_assignments_path(@course)}/new" } if can?(:manage_assignments_add)
      make << { id: "page", label: I18n.t("New page"), url: "/courses/#{@course.id}/new_page" } if can?(:manage_wiki_create)
      make << { id: "files", label: I18n.t("Upload files"), url: h.course_files_path(@course) } if can?(:manage_files_add)
      manage = []
      manage << { id: "player", label: I18n.t("Course Player setup"), url: setup_path } if can?(:manage_course_content_edit)
      manage << { id: "modules", label: I18n.t("Units"), url: course_context_modules_path } if can?(:read_as_admin)
      manage << { id: "people", label: I18n.t("People"), url: course_users_path } if can?(:read_roster)
      manage << { id: "settings", label: I18n.t("Course settings"), url: course_settings_path } if can?(:read_as_admin)
      classes = []
      classes << { id: "class", label: I18n.t("Class page"), url: "/self_paced/courses/#{@course.id}" } if class_page?
      classes << { id: "students", label: I18n.t("All students"), url: "/self_paced/dashboard?course_id=#{@course.id}" } if students_page?
      { make:, manage:, class: classes }
    end

    def students_page?
      SelfPaced.feature_enabled?(@course, :self_paced_teacher_dashboard) && DashboardScope.new(@user).course(@course.id).present?
    end

    def class_page?
      students_page? && SelfPaced.feature_enabled?(@course, :self_paced_course_view)
    end
  end
end
