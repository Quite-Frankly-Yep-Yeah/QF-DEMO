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

# The teacher dashboard's read model: one row per student and course.
#
# Progress columns are refreshed in the background by SelfPaced::StateRefresher.
# Presence columns (viewing_*, last_seen_at, last_active_at) are written by
# SelfPaced::ActivityLedger on every activity ping.
module SelfPaced
  class StudentCourseState < ApplicationRecord
    self.table_name = "student_course_states"

    belongs_to :user
    belongs_to :course
    belongs_to :root_account, class_name: "Account"
    belongs_to :current_content_tag, class_name: "ContentTag", optional: true
    belongs_to :viewing_content_tag, class_name: "ContentTag", optional: true
  end
end
