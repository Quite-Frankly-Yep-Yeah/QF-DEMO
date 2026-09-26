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

import {neighbours, roleLabel, steps} from '../player'
import {MAP} from './playerFixtures'

describe('steps', () => {
  it('lists every item in course order without the lesson headers', () => {
    expect(steps(MAP).map(item => item.id)).toEqual(['10', '11', '12', '20'])
  })
})

describe('neighbours', () => {
  it('finds the previous and next steps across units', () => {
    const place = neighbours(MAP, '12')

    expect([
      place.previous?.id,
      place.next?.id,
      place.position,
      place.total,
      place.unit?.id,
    ]).toEqual(['11', '20', 3, 4, '1'])
  })

  it('has no previous step at the start and no next step at the end', () => {
    expect([neighbours(MAP, '10').previous, neighbours(MAP, '20').next]).toEqual([null, null])
  })

  it('places a page outside the course at position 0', () => {
    expect(neighbours(MAP, null).position).toBe(0)
  })
})

describe('roleLabel', () => {
  it('names the roles students see', () => {
    expect(['instruction', 'practice', 'check', 'none'].map(r => roleLabel(r as never))).toEqual([
      'Lesson',
      'Practice',
      'Check',
      null,
    ])
  })
})
