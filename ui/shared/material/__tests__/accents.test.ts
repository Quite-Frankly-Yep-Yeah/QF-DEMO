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

import {ACCENT_GROUPS, accentHex, accentVariables, isAccentId} from '../accents'
import {contrast} from '../index'
import {THEMES} from '../themes'

describe('accents', () => {
  it('offers 19 Material and 14 Catppuccin accents', () => {
    expect(ACCENT_GROUPS.material).toHaveLength(19)
    expect(ACCENT_GROUPS.catppuccin).toHaveLength(14)
  })

  it('accepts only known accent ids', () => {
    expect(isAccentId('material:teal')).toBe(true)
    expect(isAccentId('catppuccin:mauve')).toBe(true)
    expect(isAccentId('material:mauve')).toBe(false)
    expect(isAccentId('teal')).toBe(false)
    expect(isAccentId(undefined)).toBe(false)
    expect(isAccentId(['material:teal'])).toBe(false)
  })

  it('resolves a Catppuccin accent to the current flavor, with Light using Latte', () => {
    expect(accentHex('catppuccin:mauve', 'mocha')).toBe('#CBA6F7')
    expect(accentHex('catppuccin:mauve', 'latte')).toBe('#8839EF')
    expect(accentHex('catppuccin:mauve', 'light')).toBe('#8839EF')
    expect(accentHex('material:teal', 'mocha')).toBe('#009688')
  })

  it('sets the accent, the top bar and the nav brand variables', () => {
    const vars = accentVariables('mocha', 'material:teal')
    expect(vars['--qf-accent']).toBe('#009688')
    expect(vars['--qf-app-bar']).toBe('#009688')
    expect(vars['--ic-brand-global-nav-bgd']).toBe('#009688')
    expect(vars['--ic-brand-global-nav-logo-bgd']).toBe('#009688')
    expect(vars['--ic-brand-global-nav-ic-icon-svg-fill']).toBe(vars['--qf-on-app-bar'])
    expect(vars['--ic-brand-global-nav-menu-item__text-color--active']).toBe(
      vars['--qf-on-app-bar'],
    )
  })

  it('puts readable text on every accent used as the top bar', () => {
    for (const [group, list] of Object.entries(ACCENT_GROUPS)) {
      for (const accent of list) {
        for (const theme of Object.keys(THEMES)) {
          const vars = accentVariables(theme as keyof typeof THEMES, `${group}:${accent.id}`)
          expect(contrast(vars['--qf-on-app-bar'], vars['--qf-app-bar'])).toBeGreaterThanOrEqual(
            4.5,
          )
        }
      }
    }
  })

  it('falls back to the theme ink for link text when the accent is too faint on the card', () => {
    // Material yellow on Light's white card is about 1.1:1
    const yellow = accentVariables('light', 'material:yellow')
    expect(yellow['--qf-accent']).toBe('#FFEB3B')
    expect(yellow['--qf-accent-text']).toBe(THEMES.light.tokens.ink)
    // Material blue on Light's white card reads fine
    const blue = accentVariables('light', 'material:blue')
    expect(blue['--qf-accent-text']).toBe('#2196F3')
  })
})
