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

class SetReplicaIdentitySupportsPlanTables < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    set_replica_identity :support_plans
    set_replica_identity :accommodation_types
    set_replica_identity :student_accommodations
    set_replica_identity :accommodation_acknowledgements
    set_replica_identity :support_imports
  end
end
