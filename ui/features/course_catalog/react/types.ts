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

export type Option = {id: string; name: string}

export type Teacher = Option

export type Student = {id: string; name: string; sortable_name?: string}

export type CatalogCourse = {
  id: number | string
  name: string
  course_code: string | null
  workflow_state: 'unpublished' | 'available' | 'completed' | 'deleted' | string
  start_at?: string | null
  end_at?: string | null
  account_id?: number | string
  account_name?: string
  total_students?: number
  term?: {id: number | string; name: string} | null
  teachers?: {id: number | string; display_name: string}[] | null
  blueprint?: boolean
}

export type CatalogConfig = {
  account: {id: string; name: string}
  can_create: boolean
  dashboard_url: string
}

export type StatusFilter = 'all' | 'published' | 'unpublished' | 'completed'
export type TriFilter = 'any' | 'yes' | 'no'
export type SortKey = 'course_name' | 'course_status' | 'teacher' | 'account_name'

export type Filters = {
  search: string
  terms: string[]
  subaccounts: string[]
  teachers: Teacher[]
  status: StatusFilter
  blueprint: TriFilter
  enrollments: TriFilter
  sort: SortKey
  order: 'asc' | 'desc'
}
