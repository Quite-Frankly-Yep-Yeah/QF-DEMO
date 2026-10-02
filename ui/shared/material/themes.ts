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

import themes from './themes.json'

export type ThemeId = 'light' | 'mocha'

export type ThemeTokens = {
  appBar: string
  onAppBar: string
  surface: string
  paper: string
  ink: string
  inkSecondary: string
  divider: string
  accent: string
}

export const THEMES = themes as Record<ThemeId, {name: string; tokens: ThemeTokens}>

export const DEFAULT_THEME: ThemeId = 'light'

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(THEMES, value)
}

export function tokenVar(name: keyof ThemeTokens): string {
  return `var(--qf-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)})`
}
