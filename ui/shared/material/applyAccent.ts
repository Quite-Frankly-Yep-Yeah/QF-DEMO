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

import {ACCENT_VARIABLE_NAMES, accentVariables, isAccentId} from './accents'
import type {ThemeId} from './themes'

// Puts a custom accent on <html> (or removes it): the data-accent attribute and
// the inline variables the server renders on load. Call again after a theme
// change, since a Catppuccin accent takes the shade of the current flavor.
export function applyAccent(themeId: ThemeId, accentId: string | null | undefined) {
  const root = document.documentElement
  for (const name of ACCENT_VARIABLE_NAMES) root.style.removeProperty(name)
  if (!accentId || !isAccentId(accentId)) {
    delete root.dataset.accent
    return
  }
  root.dataset.accent = accentId
  for (const [name, value] of Object.entries(accentVariables(themeId, accentId))) {
    root.style.setProperty(name, value)
  }
}
