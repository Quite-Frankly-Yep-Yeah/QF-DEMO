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

import {useEffect, useState} from 'react'
import {DEFAULT_THEME, isThemeId, THEMES, type ThemeTokens} from './themes'

function activeTokens(): ThemeTokens {
  const id = document.documentElement.dataset.theme
  return THEMES[isThemeId(id) ? id : DEFAULT_THEME].tokens
}

// The tokens of the theme on <html data-theme>, for call sites that need a
// real color (contrast(), ink(), tint()) rather than a var() string.
export function useThemeTokens(): ThemeTokens {
  const [tokens, setTokens] = useState(activeTokens)

  useEffect(() => {
    const observer = new MutationObserver(() => setTokens(activeTokens()))
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']})
    setTokens(activeTokens())
    return () => observer.disconnect()
  }, [])

  return tokens
}
