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

import {useScope as createI18nScope} from '@canvas/i18n'
import {ink, PALETTE} from './material'
import type {CatalogCourse, Filters, SortKey, StatusFilter} from './types'

const I18n = createI18nScope('course_catalog')

// The API ignores a search term shorter than this.
export const MIN_SEARCH = 3
export const PER_PAGE = 24

export const DEFAULT_FILTERS: Filters = {
  search: '',
  terms: [],
  subaccounts: [],
  teachers: [],
  status: 'all',
  blueprint: 'any',
  enrollments: 'any',
  sort: 'course_name',
  order: 'asc',
}

export function sortOptions(): {value: SortKey; label: string}[] {
  return [
    {value: 'course_name', label: I18n.t('Name')},
    {value: 'course_status', label: I18n.t('Status')},
    {value: 'teacher', label: I18n.t('Teacher')},
    {value: 'account_name', label: I18n.t('Sub-account')},
  ]
}

export function statusOptions(): {value: StatusFilter; label: string}[] {
  return [
    {value: 'all', label: I18n.t('Any status')},
    {value: 'published', label: I18n.t('Published')},
    {value: 'unpublished', label: I18n.t('Unpublished')},
    {value: 'completed', label: I18n.t('Completed')},
  ]
}

export function searchIsActive(search: string): boolean {
  return search.trim().length >= MIN_SEARCH
}

// The query for GET /api/v1/accounts/:id/courses. Only the filters that are
// set are sent, so the default catalog is the plain list.
export function buildCourseParams(filters: Filters): Record<string, string | string[] | number> {
  const params: Record<string, string | string[] | number> = {
    include: ['term', 'teachers', 'total_students', 'account_name'],
    sort: filters.sort,
    order: filters.order,
    per_page: PER_PAGE,
  }
  if (searchIsActive(filters.search)) params.search_term = filters.search.trim()
  if (filters.terms.length > 0) params.enrollment_term_id = filters.terms
  if (filters.subaccounts.length > 0) params.by_subaccounts = filters.subaccounts
  if (filters.teachers.length > 0) params.by_teachers = filters.teachers.map(t => t.id)
  if (filters.status === 'published') params.published = 'true'
  if (filters.status === 'unpublished') params.state = ['created', 'claimed']
  if (filters.status === 'completed') params.state = ['completed']
  if (filters.blueprint !== 'any') params.blueprint = filters.blueprint === 'yes' ? 'true' : 'false'
  if (filters.enrollments !== 'any') {
    params.with_enrollments = filters.enrollments === 'yes' ? 'true' : 'false'
  }
  return params
}

// How many filters differ from the defaults (the sort isn't one).
export function activeFilterCount(filters: Filters): number {
  return (
    (searchIsActive(filters.search) ? 1 : 0) +
    filters.terms.length +
    filters.subaccounts.length +
    filters.teachers.length +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.blueprint !== 'any' ? 1 : 0) +
    (filters.enrollments !== 'any' ? 1 : 0)
  )
}

export function statusLabel(state: string): string {
  if (state === 'available') return I18n.t('Published')
  if (state === 'completed') return I18n.t('Completed')
  return I18n.t('Unpublished')
}

// A course's color: the palette in course-id order, so a course keeps its
// color wherever it shows up.
export function courseColor(course: Pick<CatalogCourse, 'id'>): string {
  return PALETTE[Number(course.id) % PALETTE.length]
}

export function headerColor(course: Pick<CatalogCourse, 'id'>): string {
  return ink(courseColor(course))
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

export function teacherNames(course: CatalogCourse): string {
  const names = (course.teachers ?? []).map(t => t.display_name)
  if (names.length <= 2) return names.join(', ')
  return I18n.t('%{first}, %{second} and %{count} more', {
    first: names[0],
    second: names[1],
    count: names.length - 2,
  })
}
