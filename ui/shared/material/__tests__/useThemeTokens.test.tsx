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

import {act, renderHook} from '@testing-library/react-hooks'
import {THEMES} from '../themes'
import {useThemeTokens} from '../useThemeTokens'

describe('useThemeTokens', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme
  })

  it('returns light tokens when no theme is set', () => {
    const {result} = renderHook(() => useThemeTokens())
    expect(result.current).toEqual(THEMES.light.tokens)
  })

  it('returns mocha tokens when data-theme is mocha', () => {
    document.documentElement.dataset.theme = 'mocha'
    const {result} = renderHook(() => useThemeTokens())
    expect(result.current).toEqual(THEMES.mocha.tokens)
  })

  it('updates when the attribute changes', async () => {
    const {result} = renderHook(() => useThemeTokens())
    await act(async () => {
      document.documentElement.dataset.theme = 'mocha'
      await Promise.resolve()
    })
    expect(result.current).toEqual(THEMES.mocha.tokens)
  })

  it('falls back to light for an unknown value', () => {
    document.documentElement.dataset.theme = 'latte'
    const {result} = renderHook(() => useThemeTokens())
    expect(result.current).toEqual(THEMES.light.tokens)
  })
})
