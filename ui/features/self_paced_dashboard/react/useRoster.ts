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

import {useCallback, useEffect, useState} from 'react'
import doFetchApi from '@canvas/do-fetch-api-effect'
import type {DashboardConfig, RosterRow} from './types'

// The roster, polled while the page is visible, and the viewer's own quite frankly an example LMS
// course colors. Shared by the Students page and the course page.
export function useRoster(config: DashboardConfig) {
  const [rows, setRows] = useState<RosterRow[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [customColors, setCustomColors] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    doFetchApi<{rows: RosterRow[]}>({
      path: config.roster_url,
      params: {idle_minutes: config.idle_minutes},
    })
      .then(({json}) => {
        setRows(json?.rows ?? [])
        setNow(new Date())
        setLoadError(false)
      })
      .catch(() => setLoadError(true))
  }, [config.roster_url, config.idle_minutes])

  // Poll while the page is visible; catch up straight away when it comes back.
  useEffect(() => {
    load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, config.poll_seconds * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, config.poll_seconds])

  // the viewer's own quite frankly an example LMS course colors, if they've picked any
  useEffect(() => {
    doFetchApi<{custom_colors: Record<string, string>}>({path: '/api/v1/users/self/colors'})
      .then(({json}) => setCustomColors(json?.custom_colors ?? {}))
      .catch(() => {})
  }, [])

  return {rows, setRows, loadError, now, load, customColors}
}
