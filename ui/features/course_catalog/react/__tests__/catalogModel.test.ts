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

import {
  activeFilterCount,
  buildCourseParams,
  DEFAULT_FILTERS,
  initials,
  searchIsActive,
  teacherNames,
} from '../catalogModel'
import type {CatalogCourse} from '../types'

describe('buildCourseParams', () => {
  it('asks for the facts the cards show and sends no filters by default', () => {
    const params = buildCourseParams(DEFAULT_FILTERS)
    expect(params.include).toEqual(['term', 'teachers', 'total_students', 'account_name'])
    expect(params.sort).toBe('course_name')
    expect(params.order).toBe('asc')
    expect(Object.keys(params)).toEqual(['include', 'sort', 'order', 'per_page'])
  })

  it('leaves out a search term the API would ignore', () => {
    expect(buildCourseParams({...DEFAULT_FILTERS, search: 'al'}).search_term).toBeUndefined()
    expect(buildCourseParams({...DEFAULT_FILTERS, search: ' alg '}).search_term).toBe('alg')
  })

  it('maps every filter to its API parameter', () => {
    const params = buildCourseParams({
      ...DEFAULT_FILTERS,
      terms: ['3'],
      subaccounts: ['8', '9'],
      teachers: [{id: '5', name: 'Ms. Ruiz'}],
      blueprint: 'no',
      enrollments: 'yes',
      status: 'published',
    })
    expect(params.enrollment_term_id).toEqual(['3'])
    expect(params.by_subaccounts).toEqual(['8', '9'])
    expect(params.by_teachers).toEqual(['5'])
    expect(params.blueprint).toBe('false')
    expect(params.with_enrollments).toBe('true')
    expect(params.published).toBe('true')
  })

  it('maps unpublished and completed to course states', () => {
    expect(buildCourseParams({...DEFAULT_FILTERS, status: 'unpublished'}).state).toEqual([
      'created',
      'claimed',
    ])
    expect(buildCourseParams({...DEFAULT_FILTERS, status: 'completed'}).state).toEqual([
      'completed',
    ])
  })
})

describe('activeFilterCount', () => {
  it('is zero for the defaults and ignores the sort', () => {
    expect(activeFilterCount({...DEFAULT_FILTERS, sort: 'teacher', order: 'desc'})).toBe(0)
  })

  it('counts each selected term, sub-account and teacher and each changed choice', () => {
    expect(
      activeFilterCount({
        ...DEFAULT_FILTERS,
        search: 'algebra',
        terms: ['1', '2'],
        teachers: [{id: '5', name: 'x'}],
        status: 'completed',
        blueprint: 'yes',
      }),
    ).toBe(6)
  })
})

describe('searchIsActive', () => {
  it('needs three characters', () => {
    expect(searchIsActive('ab')).toBe(false)
    expect(searchIsActive(' abc ')).toBe(true)
  })
})

describe('initials and teacherNames', () => {
  const course = (teachers: string[]): CatalogCourse => ({
    id: 1,
    name: 'x',
    course_code: null,
    workflow_state: 'available',
    teachers: teachers.map((display_name, i) => ({id: i, display_name})),
  })

  it('takes the first letters of the first two words', () => {
    expect(initials('Algebra 1 Honors')).toBe('A1')
    expect(initials('  ')).toBe('')
  })

  it('lists up to two teachers and counts the rest', () => {
    expect(teacherNames(course([]))).toBe('')
    expect(teacherNames(course(['A', 'B']))).toBe('A, B')
    expect(teacherNames(course(['A', 'B', 'C', 'D']))).toBe('A, B and 2 more')
  })
})
