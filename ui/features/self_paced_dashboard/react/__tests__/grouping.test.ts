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

import {groupByStudent} from '../grouping'
import {rosterRow} from './fixtures'

const biology = {id: '7', name: 'Biology', course_code: 'BIO'}

describe('groupByStudent', () => {
  const [maya] = groupByStudent([
    rosterRow({
      id: '1',
      name: 'Maya Lopez',
      status: 'away',
      seconds_today: 600,
      days_behind: 1,
      attempts_on_current_item: 1,
    }),
    rosterRow({
      id: '1',
      name: 'Maya Lopez',
      course: biology,
      status: 'working',
      seconds_today: 300,
      days_behind: 4,
      attempts_on_current_item: 3,
    }),
  ])

  it('lists the classes by name and follows the one they are in now', () => {
    expect(maya.rows.map(row => row.course.name)).toEqual(['Algebra 1', 'Biology'])
    expect(maya.primary.course.name).toBe('Biology')
    expect(maya.summary.status).toBe('working')
  })

  it('adds up time and keeps the worst pace and most tries', () => {
    expect(maya.summary).toMatchObject({
      seconds_today: 900,
      days_behind: 4,
      attempts_on_current_item: 3,
    })
  })

  it("doesn't mix grades from different classes", () => {
    expect(maya.summary.score).toBeNull()
  })

  it('leaves a single-class student as they are', () => {
    const row = rosterRow({id: '2', name: 'Jordan Kim'})

    expect(groupByStudent([row])[0].summary).toBe(row)
  })
})
