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

# Tells a student's assigned mentors (or the course's teachers) when the
# alert evaluator opens an alert. One type, so people set their email
# preference for alerts in one place.
class AddSelfPacedAlertNotification < ActiveRecord::Migration[8.0]
  tag :predeploy

  def up
    if Shard.current.default? && !::Rails.env.test?
      Canvas::MessageHelper.create_notification({
                                                  name: "Self Paced Alert",
                                                  delay_for: 0,
                                                  category: "Grading"
                                                })
    end
  end

  def down
    if Shard.current.default?
      Notification.where(name: "Self Paced Alert").delete_all
    end
  end
end
