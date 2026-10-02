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

import {contrast} from '../index'
import {DEFAULT_THEME, isThemeId, THEMES, tokenVar} from '../themes'

const TOKEN_KEYS = [
  'accent',
  'appBar',
  'divider',
  'ink',
  'inkSecondary',
  'onAppBar',
  'paper',
  'surface',
]

describe('themes', () => {
  it('defines every token in every theme', () => {
    for (const theme of Object.values(THEMES)) {
      expect(Object.keys(theme.tokens).sort()).toEqual(TOKEN_KEYS)
    }
  })

  it('keeps ink on surface, ink on paper and onAppBar on appBar at least 4.5:1', () => {
    for (const {tokens} of Object.values(THEMES)) {
      expect(contrast(tokens.ink, tokens.surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(tokens.ink, tokens.paper)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(tokens.onAppBar, tokens.appBar)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('rejects unknown theme ids', () => {
    expect(isThemeId('mocha')).toBe(true)
    expect(isThemeId('latte')).toBe(false)
    expect(isThemeId(undefined)).toBe(false)
    expect(isThemeId(5)).toBe(false)
  })

  it('maps a camelCase token to a css variable', () => {
    expect(tokenVar('inkSecondary')).toBe('var(--qf-ink-secondary)')
    expect(tokenVar('appBar')).toBe('var(--qf-app-bar)')
  })

  it('keeps light equal to the existing Material values', () => {
    expect(DEFAULT_THEME).toBe('light')
    expect(THEMES.light.tokens.appBar).toBe('#2B7ABC')
    expect(THEMES.light.tokens.surface).toBe('#EEEEEE')
    expect(THEMES.light.tokens.paper).toBe('#FFFFFF')
  })
})
