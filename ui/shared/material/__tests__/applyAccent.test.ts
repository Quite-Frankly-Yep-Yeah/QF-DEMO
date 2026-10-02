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

import {accentVariables} from '../accents'
import {applyAccent} from '../applyAccent'

describe('applyAccent', () => {
  afterEach(() => {
    applyAccent('light', null)
  })

  it('sets data-accent and the accent variables on <html>', () => {
    applyAccent('mocha', 'catppuccin:mauve')
    expect(document.documentElement.dataset.accent).toBe('catppuccin:mauve')
    const vars = accentVariables('mocha', 'catppuccin:mauve')
    for (const [name, value] of Object.entries(vars)) {
      expect(document.documentElement.style.getPropertyValue(name)).toBe(value)
    }
  })

  it('recomputes the shade when the theme changes under the same accent', () => {
    applyAccent('mocha', 'catppuccin:mauve')
    applyAccent('latte', 'catppuccin:mauve')
    expect(document.documentElement.style.getPropertyValue('--qf-accent')).toBe('#8839EF')
  })

  it('clears the attribute and every variable it set when there is no accent', () => {
    document.documentElement.style.setProperty('--unrelated', 'kept')
    applyAccent('mocha', 'material:teal')
    applyAccent('mocha', null)
    expect(document.documentElement.dataset.accent).toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--qf-accent')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--ic-brand-global-nav-bgd')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--unrelated')).toBe('kept')
    document.documentElement.style.removeProperty('--unrelated')
  })
})
