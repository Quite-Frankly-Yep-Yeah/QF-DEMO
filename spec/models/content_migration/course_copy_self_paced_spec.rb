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

# Sets up its own copy instead of the shared "course copy" context, whose
# before hook needs Account#account_domains (an Instructure-hosted plugin not in
# this codebase).
describe ContentMigration do
  context "course copy of self-paced course player settings" do
    let_once(:teacher) { user_factory(active_all: true) }
    let_once(:copy_from) { course_with_teacher(user: teacher, course_name: "from course", active_all: true).course }
    let_once(:copy_to) { course_with_teacher(user: teacher, course_name: "to course").course }

    def run_course_copy
      migration = ContentMigration.new(context: copy_to,
                                       user: teacher,
                                       source_course: copy_from,
                                       migration_type: "course_copy_importer",
                                       copy_options: { everything: "1" })
      migration.migration_settings[:import_immediately] = true
      migration.save!
      migration.set_default_settings
      Canvas::Migration::Worker::CourseCopyWorker.new.perform(migration)
      expect(migration.reload.workflow_state).to eql("imported")
      copy_to.reload
    end

    it "copies item roles and rules, must_watch requirements and the course settings" do
      mod = copy_from.context_modules.create!(name: "Unit 1")
      page_tag = mod.add_item(type: "wiki_page", id: copy_from.wiki_pages.create!(title: "Video lesson").id)
      SelfPaced::ItemSetting.create!(content_tag: page_tag, course: copy_from, role: "instruction", estimated_minutes: 12, watch_fraction: 0.9)
      mod.update!(completion_requirements: [{ id: page_tag.id, type: "must_watch" }])
      copy_from.update!(self_paced_mastery_threshold: "80", self_paced_provisional_checks: true)

      run_course_copy

      new_tag = copy_to.context_module_tags.find_by!(title: "Video lesson")
      setting = SelfPaced::ItemSetting.find_by!(content_tag: new_tag)
      expect(setting.slice(:role, :estimated_minutes, :watch_fraction)).to eql("role" => "instruction", "estimated_minutes" => 12, "watch_fraction" => 0.9)
      expect(new_tag.context_module.completion_requirements).to eql([{ id: new_tag.id, type: "must_watch" }])
      expect([copy_to.self_paced_mastery_threshold, copy_to.self_paced_provisional_checks]).to eql(["80", true])
    end
  end
end
