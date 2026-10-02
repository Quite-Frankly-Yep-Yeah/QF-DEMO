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
import doFetchApi from '@canvas/do-fetch-api-effect'
import {showFlashError} from '@instructure/platform-alerts'
import {useThemeChoice} from '../useThemeChoice'

vi.mock('@canvas/do-fetch-api-effect')
vi.mock('@instructure/platform-alerts')

const mockFetch = doFetchApi as unknown as ReturnType<typeof vi.fn>

describe('useThemeChoice', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    ;(showFlashError as unknown as ReturnType<typeof vi.fn>).mockReset()
    ;(showFlashError as unknown as ReturnType<typeof vi.fn>).mockReturnValue(() => {})
    window.ENV = {...window.ENV, THEME: 'light'}
    document.documentElement.dataset.theme = 'light'
  })

  afterEach(() => {
    delete document.documentElement.dataset.theme
  })

  it('starts from ENV.THEME when <html> has no theme, and falls back to light for an unknown value', () => {
    delete document.documentElement.dataset.theme
    window.ENV.THEME = 'mocha'
    expect(renderHook(() => useThemeChoice()).result.current.theme).toBe('mocha')
    window.ENV.THEME = 'nord'
    expect(renderHook(() => useThemeChoice()).result.current.theme).toBe('light')
  })

  it('prefers the theme already on <html> over a stale ENV.THEME', () => {
    window.ENV.THEME = 'light'
    document.documentElement.dataset.theme = 'mocha'
    expect(renderHook(() => useThemeChoice()).result.current.theme).toBe('mocha')
  })

  it('applies the theme at once and saves it', async () => {
    mockFetch.mockResolvedValue({json: {theme: 'mocha'}})
    const {result} = renderHook(() => useThemeChoice())
    await act(async () => {
      await result.current.choose('mocha')
    })
    expect(document.documentElement.dataset.theme).toBe('mocha')
    expect(mockFetch).toHaveBeenCalledWith({
      path: '/api/v1/users/self/settings',
      method: 'PUT',
      body: {theme: 'mocha'},
    })
    expect(result.current.theme).toBe('mocha')
  })

  it('reverts and shows an error when the save fails, then still works', async () => {
    mockFetch.mockRejectedValueOnce(new Error('nope'))
    const {result} = renderHook(() => useThemeChoice())
    await act(async () => {
      await result.current.choose('mocha')
    })
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(result.current.theme).toBe('light')
    expect(showFlashError).toHaveBeenCalled()

    mockFetch.mockResolvedValueOnce({json: {theme: 'mocha'}})
    await act(async () => {
      await result.current.choose('mocha')
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(document.documentElement.dataset.theme).toBe('mocha')
  })
})
