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

import doFetchApi from '@canvas/do-fetch-api-effect'
import authenticity_token from '@canvas/authenticity-token'

// Activity pinger for students in self-paced courses (docs/fork-plan.md §2.7-2.8).
//
// Once a second it notes whether the student did anything (mouse, keyboard,
// scroll, touch). While the tab is visible it sends one ping a minute with the
// number of active seconds, which may be 0: that zero is how the dashboard tells
// "online but idle" from "gone". A hidden tab sends nothing. Remaining active
// seconds are flushed with a beacon when the page is hidden or closed.

export type SelfPacedActivityConfig = {
  ping_url: string
  module_item_id?: string | null
}

export const PING_INTERVAL_SECONDS = 60

// 'self-paced-activity' is sent by the video tracker while a video plays
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'self-paced-activity',
] as const

export function startSelfPacedActivityTracking(config: SelfPacedActivityConfig): () => void {
  let activeSeconds = 0
  let activeThisSecond = false
  let secondsSincePing = 0

  const markActive = () => {
    activeThisSecond = true
  }

  const fields = (seconds: number): Record<string, string> => {
    const data: Record<string, string> = {seconds: String(seconds), path: window.location.pathname}
    if (config.module_item_id) data.module_item_id = config.module_item_id
    return data
  }

  const ping = () => {
    const seconds = activeSeconds
    activeSeconds = 0
    secondsSincePing = 0
    doFetchApi({path: config.ping_url, method: 'POST', body: fields(seconds)}).catch(() => {
      // activity pings are best effort
    })
  }

  // sendBeacon survives the page closing, but can only POST form data
  const flush = () => {
    if (activeSeconds === 0) return
    const data = new FormData()
    Object.entries(fields(activeSeconds)).forEach(([key, value]) => data.append(key, value))
    data.append('authenticity_token', authenticity_token())
    navigator.sendBeacon(config.ping_url, data)
    activeSeconds = 0
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush()
  }

  const timer = setInterval(() => {
    if (document.visibilityState !== 'visible') {
      activeThisSecond = false
      return
    }
    if (activeThisSecond) activeSeconds++
    activeThisSecond = false
    secondsSincePing++
    if (secondsSincePing >= PING_INTERVAL_SECONDS) ping()
  }, 1000)

  ACTIVITY_EVENTS.forEach(event => {
    document.addEventListener(event, markActive, {passive: true, capture: true})
  })
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', flush)

  return () => {
    clearInterval(timer)
    ACTIVITY_EVENTS.forEach(event => {
      document.removeEventListener(event, markActive, {capture: true})
    })
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', flush)
  }
}
