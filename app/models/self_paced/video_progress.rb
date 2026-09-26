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

# How much of a module item's video a student has actually watched
# (docs/fork-plan.md §2.9). Only the highest fraction is kept.
module SelfPaced
  class VideoProgress < ApplicationRecord
    self.table_name = "video_progress"

    belongs_to :user
    belongs_to :content_tag
    belongs_to :course
    belongs_to :root_account, class_name: "Account"

    before_validation { self.root_account_id ||= course&.root_account_id }
  end
end
