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

# Tells the right staff when a lower grade takes back a requirement the student
# had met, re-locking the items after it (decision 6): the student's assigned
# mentors (their caseload), or the course's teachers when nobody has pinned
# the student.
module SelfPaced
  module RelockNotifier
    NOTIFICATION_NAME = "Self Paced Item Relocked"

    def self.notify(progression, requirement)
      course = progression.context_module.context
      return unless Gating.player_course?(course)

      tag = progression.context_module.content_tags.find_by(id: requirement[:id])
      submission = tag&.assignment&.submissions&.find_by(user_id: progression.user_id)
      return unless submission

      notification = BroadcastPolicy.notification_finder.by_name(NOTIFICATION_NAME)
      return unless notification

      notification.create_message(submission, recipients(progression.user, course))
    end

    def self.recipients(student, course)
      mentors = MentorCaseload.mentors_for(student, course.root_account).to_a
      mentors.presence || course.participating_instructors.distinct.to_a
    end
  end
end
