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

# Tells a school's admins when a course's grading backlog passes the school's
# limit (TeacherWorkflow::BacklogEvaluator). One notification per opened alert.
class AddGradingBacklogNotification < ActiveRecord::Migration[8.0]
  tag :predeploy

  def up
    if Shard.current.default? && !::Rails.env.test?
      Canvas::MessageHelper.create_notification({
                                                  name: "Grading Backlog",
                                                  delay_for: 0,
                                                  category: "Grading"
                                                })
    end
  end

  def down
    if Shard.current.default?
      Notification.where(name: "Grading Backlog").delete_all
    end
  end
end
