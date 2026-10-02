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

import accents from './accents.json'
import {contrast} from './index'
import {isThemeId, THEMES, type ThemeId, type ThemeTokens} from './themes'

export type Accent = {id: string; name: string; hex: string}

type CatppuccinAccent = {id: string; name: string} & Record<
  'latte' | 'frappe' | 'macchiato' | 'mocha',
  string
>

const MATERIAL = accents.material as Array<{id: string; name: string; hex: string}>
const CATPPUCCIN = accents.catppuccin as CatppuccinAccent[]

export const ACCENT_GROUPS = {material: MATERIAL, catppuccin: CATPPUCCIN}

// "material:teal" or "catppuccin:mauve"
export function isAccentId(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const [group, id] = value.split(':')
  if (group === 'material') return MATERIAL.some(a => a.id === id)
  if (group === 'catppuccin') return CATPPUCCIN.some(a => a.id === id)
  return false
}

const FLAVORS = ['latte', 'frappe', 'macchiato', 'mocha'] as const

// A Catppuccin accent takes the shade of the current flavor; Light uses Latte's.
export function accentHex(accentId: string, themeId: ThemeId): string {
  const [group, id] = accentId.split(':')
  if (group === 'material') return MATERIAL.find(a => a.id === id)!.hex
  const flavor = (FLAVORS as readonly string[]).includes(themeId)
    ? (themeId as (typeof FLAVORS)[number])
    : 'latte'
  return CATPPUCCIN.find(a => a.id === id)![flavor]
}

// pure black: with white it guarantees 4.5:1 on any accent (near-black leaves a gap for mid-tones)
const DARK_TEXT = '#000000'

// The CSS variables a custom accent sets on <html>: the accent itself, the top
// bar filled with it (with white or near-black text, whichever reads better),
// and the nav's brand variables so the existing nav CSS follows. Keep in sync
// with QfThemes.accent_style on the server.
export function accentVariables(themeId: ThemeId, accentId: string): Record<string, string> {
  const hex = accentHex(accentId, themeId)
  const tokens = THEMES[isThemeId(themeId) ? themeId : 'light'].tokens
  const onBar = contrast('#FFFFFF', hex) >= contrast(DARK_TEXT, hex) ? '#FFFFFF' : DARK_TEXT
  return {
    '--qf-accent': hex,
    '--qf-accent-text': contrast(hex, tokens.paper) >= 3 ? hex : tokens.ink,
    '--qf-app-bar': hex,
    '--qf-on-app-bar': onBar,
    '--ic-brand-global-nav-bgd': hex,
    '--ic-brand-global-nav-logo-bgd': hex,
    '--ic-brand-global-nav-ic-icon-svg-fill': onBar,
    '--ic-brand-global-nav-ic-icon-svg-fill--active': onBar,
    '--ic-brand-global-nav-menu-item__text-color': onBar,
    '--ic-brand-global-nav-menu-item__text-color--active': onBar,
  }
}

// A theme's tokens with a custom accent merged in: the accent, its link text,
// and the top bar (the same overrides accentVariables puts in CSS).
export function tokensWithAccent(
  themeId: ThemeId,
  accentId: string | null | undefined,
): ThemeTokens {
  const base = THEMES[isThemeId(themeId) ? themeId : 'light'].tokens
  if (!accentId || !isAccentId(accentId)) return base
  const vars = accentVariables(themeId, accentId)
  return {
    ...base,
    accent: vars['--qf-accent'],
    accentText: vars['--qf-accent-text'],
    appBar: vars['--qf-app-bar'],
    onAppBar: vars['--qf-on-app-bar'],
  }
}

// Every CSS variable accentVariables can set, to clear them again.
export const ACCENT_VARIABLE_NAMES = Object.keys(accentVariables('light', 'material:red'))
