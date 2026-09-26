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
  applyFilters,
  matchesSearch,
  quickFilterCounts,
  readViewState,
  writeViewState,
} from '../filters'
import {NOW, ROWS, rosterRow} from './fixtures'

const names = (rows: typeof ROWS) => [...new Set(rows.map(row => row.student.name))]

describe('matchesSearch', () => {
  it('finds every word anywhere in the name, ignoring case and accents', () => {
    const row = rosterRow({id: '9', name: 'José Álvarez'})

    expect(matchesSearch(row, 'jose')).toBe(true)
    expect(matchesSearch(row, 'ALV jos')).toBe(true)
    expect(matchesSearch(row, 'maria')).toBe(false)
    expect(matchesSearch(row, '  ')).toBe(true)
  })
})

describe('applyFilters', () => {
  it('narrows the roster to the search', () => {
    expect(names(applyFilters(ROWS, {search: 'kim', quick: 'all', now: NOW}))).toEqual([
      'Jordan Kim',
    ])
  })

  it('finds students who are stuck', () => {
    expect(names(applyFilters(ROWS, {search: '', quick: 'stuck', now: NOW}))).toEqual([
      'Jordan Kim',
    ])
  })

  it('finds students who have been away for days', () => {
    const fourDaysAgo = new Date(NOW.getTime() - 4 * 86_400_000).toISOString()
    const rows = [
      ...ROWS,
      rosterRow({id: '4', name: 'Ada Stone', status: 'away', last_active_at: fourDaysAgo}),
    ]

    expect(names(applyFilters(rows, {search: '', quick: 'inactive', now: NOW}))).toEqual([
      'Ada Stone',
    ])
  })

  it("keeps all of a student's classes when one of them matches", () => {
    const biology = {id: '7', name: 'Biology', course_code: 'BIO'}
    const rows = [
      rosterRow({id: '1', name: 'Maya Lopez', days_behind: 5}),
      rosterRow({id: '1', name: 'Maya Lopez', course: biology, days_behind: 0}),
    ]

    expect(applyFilters(rows, {search: '', quick: 'behind', now: NOW})).toHaveLength(2)
  })
})

describe('quickFilterCounts', () => {
  it('counts students for each chip', () => {
    expect(quickFilterCounts(ROWS, NOW)).toEqual({
      all: 3,
      working: 1,
      stuck: 1,
      behind: 0,
      inactive: 0,
    })
  })
})

describe('view state in the address bar', () => {
  it('reads what it wrote', () => {
    const query = writeViewState('', {tab: 'live', search: 'kim', quick: 'stuck', course: '4'})

    expect(readViewState(query)).toEqual({tab: 'live', search: 'kim', quick: 'stuck', course: '4'})
  })

  it('leaves the defaults out', () => {
    expect(writeViewState('?q=old', {tab: 'roster', search: '', quick: 'all', course: null})).toBe(
      '',
    )
  })

  it('ignores values it does not know', () => {
    expect(readViewState('?view=grid&show=everyone')).toEqual({})
  })
})
