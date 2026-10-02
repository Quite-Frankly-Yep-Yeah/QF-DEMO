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

import {renderHook} from '@testing-library/react-hooks'
import {useMaterialPage} from '../useMaterialPage'

describe('useMaterialPage', () => {
  it('marks <body> as a material page while mounted', () => {
    const {unmount} = renderHook(() => useMaterialPage())
    expect(document.body.classList.contains('material-page')).toBe(true)
    unmount()
    expect(document.body.classList.contains('material-page')).toBe(false)
  })

  it('keeps the mark until the last of two mounted pages unmounts', () => {
    const a = renderHook(() => useMaterialPage())
    const b = renderHook(() => useMaterialPage())
    a.unmount()
    expect(document.body.classList.contains('material-page')).toBe(true)
    b.unmount()
    expect(document.body.classList.contains('material-page')).toBe(false)
  })
})
