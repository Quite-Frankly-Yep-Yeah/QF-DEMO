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

import {dayNumber, formatMinutes, paceLabel, paceTone, parsePlanDate, valueOn} from '../pacing'

describe('paceTone', () => {
  it('reads days ahead as a tone', () => {
    expect([2, 0, -1, -2, -3, -10].map(days => paceTone(days))).toEqual([
      'ahead',
      'on_pace',
      'behind',
      'behind',
      'far_behind',
      'far_behind',
    ])
  })

  it('says finished whatever the days', () => {
    expect(paceTone(-4, true)).toBe('finished')
  })

  it('has no tone without a plan', () => {
    expect(paceTone(null)).toBeNull()
  })
})

describe('paceLabel', () => {
  it('counts days in words', () => {
    expect([paceLabel(1), paceLabel(3), paceLabel(0), paceLabel(-1), paceLabel(-4)]).toEqual([
      '1 day ahead',
      '3 days ahead',
      'On pace',
      '1 day behind',
      '4 days behind',
    ])
  })
})

describe('parsePlanDate', () => {
  it('keeps the calendar day in the local time zone', () => {
    const date = parsePlanDate('2026-10-05')

    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 5])
  })
})

describe('formatMinutes', () => {
  it('uses hours past an hour', () => {
    expect([formatMinutes(25), formatMinutes(60), formatMinutes(95)]).toEqual([
      '25 min',
      '1 h',
      '1 h 35 min',
    ])
  })
})

describe('valueOn', () => {
  const series: [string, number][] = [
    ['2026-10-05', 20],
    ['2026-10-07', 60],
  ]

  it('carries the last value forward to later days', () => {
    expect([
      valueOn(series, '2026-10-04'),
      valueOn(series, '2026-10-06'),
      valueOn(series, '2026-10-09'),
    ]).toEqual([null, 20, 60])
  })

  it('counts whole days', () => {
    expect(dayNumber('2026-10-06') - dayNumber('2026-10-05')).toBe(1)
  })
})
