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

import {useCallback, useRef, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {showFlashError} from '@instructure/platform-alerts'
import {isAccentId} from '@canvas/material/accents'
import {applyAccent} from '@canvas/material/applyAccent'
import {DEFAULT_THEME, isThemeId, type ThemeId} from '@canvas/material/themes'

const I18n = createI18nScope('account_sidebar')

const SETTINGS_PATH = '/api/v1/users/self/settings'

// <html data-theme> is the live value (it follows picks made before the tray
// was reopened); ENV.THEME is only what the page loaded with.
function initialTheme(): ThemeId {
  const live = document.documentElement.dataset.theme
  if (isThemeId(live)) return live
  const saved = window.ENV?.THEME
  return isThemeId(saved) ? saved : DEFAULT_THEME
}

function initialAccent(): string | null {
  const live = document.documentElement.dataset.accent
  if (isAccentId(live)) return live
  const saved = window.ENV?.ACCENT
  return isAccentId(saved) ? saved : null
}

// Applies a theme or accent to <html> at once (a live preview), saves it, and
// puts the previous value back if the save fails. A custom accent survives a
// theme change; applyAccent re-shades it for the new theme.
export function useThemeChoice() {
  const [theme, setTheme] = useState<ThemeId>(initialTheme)
  const [accent, setAccent] = useState<string | null>(initialAccent)
  const currentTheme = useRef<ThemeId>(theme)
  const currentAccent = useRef<string | null>(accent)

  const applyTheme = (id: ThemeId) => {
    currentTheme.current = id
    document.documentElement.dataset.theme = id
    applyAccent(id, currentAccent.current)
    setTheme(id)
  }

  const applyAccentChoice = (id: string | null) => {
    currentAccent.current = id
    applyAccent(currentTheme.current, id)
    setAccent(id)
  }

  const choose = useCallback(async (id: ThemeId) => {
    const previous = currentTheme.current
    applyTheme(id)
    try {
      await doFetchApi({path: SETTINGS_PATH, method: 'PUT', body: {theme: id}})
    } catch (err) {
      applyTheme(previous)
      showFlashError(I18n.t('Your theme could not be saved.'))(err as Error)
    }
  }, [])

  const chooseAccent = useCallback(async (id: string | null) => {
    const previous = currentAccent.current
    applyAccentChoice(id)
    try {
      await doFetchApi({path: SETTINGS_PATH, method: 'PUT', body: {accent: id ?? ''}})
    } catch (err) {
      applyAccentChoice(previous)
      showFlashError(I18n.t('Your accent color could not be saved.'))(err as Error)
    }
  }, [])

  return {theme, accent, choose, chooseAccent}
}
