/*
 * Copyright (C) 2026 - present quite frankly an example LMS contributors
 *
 * This file is part of quite frankly an example LMS, a modified version of Canvas.
 *
 * quite frankly an example LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * quite frankly an example LMS is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import {EnvDateRange} from '../DateRange'

export type MasterCourseData = {
  is_master_course_child_content?: boolean
  is_master_course_master_content?: boolean
  master_course_restrictions: unknown
  restricted_by_master_course: boolean
}

/**
 * Course-level ENV values that more than one feature reads.
 */
export interface EnvCourseShared {
  SECTIONS: unknown
  COURSE_ID: string
  VALID_DATE_RANGE: EnvDateRange
  MASTER_COURSE_DATA: MasterCourseData
  IS_MASQUERADING: boolean
}
