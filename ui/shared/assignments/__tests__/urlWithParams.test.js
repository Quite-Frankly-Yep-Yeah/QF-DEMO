/*
 * Copyright (C) 2025 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import urlWithParams from '../urlWithParams'

describe('urlWithParams', () => {
  test('returns the url untouched when there are no params', () => {
    expect(urlWithParams('/courses/1/assignments/2')).toBe('/courses/1/assignments/2')
    expect(urlWithParams('/courses/1/assignments/2', {})).toBe('/courses/1/assignments/2')
  })

  test('appends params to a relative url', () => {
    const result = new URL(urlWithParams('/courses/1/assignments/2', {display: 'full_width'}))
    expect(result.pathname).toBe('/courses/1/assignments/2')
    expect(result.searchParams.get('display')).toBe('full_width')
  })

  test('keeps existing params', () => {
    const result = new URL(urlWithParams('/x?a=1', {b: '2'}))
    expect(result.searchParams.get('a')).toBe('1')
    expect(result.searchParams.get('b')).toBe('2')
  })
})
