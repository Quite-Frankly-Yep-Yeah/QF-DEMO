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

namespace :course_accent_colors do
  desc "Queue accent-colour extraction for every course that has an image but no course_color yet"
  task backfill: :environment do
    count = 0
    Course.not_deleted.find_each do |course|
      next if course.course_color.present?
      next unless course.image_id.present? || course.image_url.present?

      course.delay_if_production(singleton: "course_accent_color_#{course.global_id}").sync_accent_color
      count += 1
    end
    puts "Queued accent-colour extraction for #{count} course(s)."
  end
end
