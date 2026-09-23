/*
 * Copyright (C) 2026 - present EXAMPLE contributors
 *
 * This file is part of EXAMPLE LMS, a modified version of Canvas.
 *
 * EXAMPLE LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import {COURSE_PALETTE, courseColors, tint} from '../colors'
import {fillTemplate, formatDuration, formatLastActive, initials, isStuck} from '../format'
import {NOW} from './fixtures'

describe('formatDuration', () => {
  it('shows minutes under an hour and hours with minutes above', () => {
    expect([0, 59, 60, 2700, 3600, 3900].map(formatDuration)).toEqual([
      '0 min',
      '0 min',
      '1 min',
      '45 min',
      '1 h',
      '1 h 5 min',
    ])
  })
})

describe('formatLastActive', () => {
  const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString()

  it('reads naturally from just now to days ago', () => {
    expect(
      [ago(0), ago(5), ago(180), ago(60 * 30), ago(60 * 24 * 4)].map(iso =>
        formatLastActive(iso, NOW),
      ),
    ).toEqual(['just now', '5 min ago', '3 h ago', 'yesterday', '4 days ago'])
  })

  it('says never when the student has never been active', () => {
    expect(formatLastActive(null, NOW)).toBe('never')
  })
})

describe('initials', () => {
  it('uses the first and last names', () => {
    expect([initials('Maya Lopez'), initials('Jordan'), initials('Ana María de la Cruz')]).toEqual([
      'ML',
      'J',
      'AC',
    ])
  })
})

describe('isStuck', () => {
  it('flags three or more attempts on the current item', () => {
    expect([2, 3].map(n => isStuck({attempts_on_current_item: n}))).toEqual([false, true])
  })
})

describe('fillTemplate', () => {
  it('fills in and escapes path parameters', () => {
    expect(
      fillTemplate('/api/v1/self_paced/courses/:course_id/students/:student_id', {
        course_id: '4',
        student_id: '1 2',
      }),
    ).toBe('/api/v1/self_paced/courses/4/students/1%202')
  })
})

describe('courseColors', () => {
  it('gives courses palette slots in id order, whatever order they arrive in', () => {
    expect(courseColors(['12', '3', '7'])).toEqual({
      '3': COURSE_PALETTE[0],
      '7': COURSE_PALETTE[1],
      '12': COURSE_PALETTE[2],
    })
  })

  it("prefers the viewer's own Canvas course colors", () => {
    expect(courseColors(['3', '7'], {course_7: '#123456'})).toEqual({
      '3': COURSE_PALETTE[0],
      '7': '#123456',
    })
  })
})

describe('tint', () => {
  it('turns a hex color into a translucent rgba', () => {
    expect(tint('#2a78d6', 0.5)).toBe('rgba(42, 120, 214, 0.5)')
  })
})
