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
import {DEFAULT_THEME, isThemeId, type ThemeId} from '@canvas/material/themes'

const I18n = createI18nScope('account_sidebar')

// <html data-theme> is the live value (it follows picks made before the tray
// was reopened); ENV.THEME is only what the page loaded with.
function initialTheme(): ThemeId {
  const live = document.documentElement.dataset.theme
  if (isThemeId(live)) return live
  const saved = window.ENV?.THEME
  return isThemeId(saved) ? saved : DEFAULT_THEME
}

// Applies a theme to <html> at once (a live preview), saves it, and puts the
// previous theme back if the save fails.
export function useThemeChoice() {
  const [theme, setTheme] = useState<ThemeId>(initialTheme)
  const current = useRef<ThemeId>(theme)

  const apply = (id: ThemeId) => {
    current.current = id
    document.documentElement.dataset.theme = id
    setTheme(id)
  }

  const choose = useCallback(async (id: ThemeId) => {
    const previous = current.current
    apply(id)
    try {
      await doFetchApi({
        path: '/api/v1/users/self/settings',
        method: 'PUT',
        body: {theme: id},
      })
    } catch (err) {
      apply(previous)
      showFlashError(I18n.t('Your theme could not be saved.'))(err as Error)
    }
  }, [])

  return {theme, choose}
}
