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

import {useEffect} from 'react'

let mounted = 0

// Marks <body> as hosting a Material page so the active theme can paint the
// backdrop behind it (see app/stylesheets/base/_themes.scss).
export function useMaterialPage() {
  useEffect(() => {
    mounted += 1
    document.body.classList.add('material-page')
    return () => {
      mounted -= 1
      if (mounted === 0) document.body.classList.remove('material-page')
    }
  }, [])
}
