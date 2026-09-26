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
import {PING_INTERVAL_SECONDS, startSelfPacedActivityTracking} from '../activityTracker'

vi.mock('@canvas/do-fetch-api-effect', () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@canvas/authenticity-token', () => ({
  __esModule: true,
  default: () => 'csrf-token',
}))

const mockFetch = vi.mocked(doFetchApi)

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {configurable: true, value: state})
}

// one second of the student moving the mouse
function activeSecond() {
  document.dispatchEvent(new Event('mousemove'))
  vi.advanceTimersByTime(1000)
}

describe('startSelfPacedActivityTracking', () => {
  let stop: () => void
  const sendBeacon = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockClear()
    sendBeacon.mockClear()
    Object.defineProperty(navigator, 'sendBeacon', {configurable: true, value: sendBeacon})
    setVisibility('visible')
    stop = startSelfPacedActivityTracking({
      ping_url: '/api/v1/courses/1/self_paced/activity',
      module_item_id: '7',
    })
  })

  afterEach(() => {
    stop()
    vi.useRealTimers()
  })

  it('pings once a minute with the active seconds, the item and the path', () => {
    for (let i = 0; i < 10; i++) activeSecond()
    vi.advanceTimersByTime((PING_INTERVAL_SECONDS - 10) * 1000)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith({
      path: '/api/v1/courses/1/self_paced/activity',
      method: 'POST',
      body: {seconds: '10', path: window.location.pathname, module_item_id: '7'},
    })
  })

  it('still pings with 0 seconds while the tab is open but idle', () => {
    vi.advanceTimersByTime(PING_INTERVAL_SECONDS * 1000)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0].body).toMatchObject({seconds: '0'})
  })

  it('counts each second once, however many events happen in it', () => {
    for (let i = 0; i < 50; i++) document.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(PING_INTERVAL_SECONDS * 1000)

    expect(mockFetch.mock.calls[0][0].body).toMatchObject({seconds: '1'})
  })

  it('sends nothing while the tab is hidden', () => {
    setVisibility('hidden')
    vi.advanceTimersByTime(PING_INTERVAL_SECONDS * 2 * 1000)

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('flushes unsent active seconds with a beacon when the tab is hidden', () => {
    for (let i = 0; i < 5; i++) activeSecond()
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url, data] = sendBeacon.mock.calls[0]
    expect(url).toBe('/api/v1/courses/1/self_paced/activity')
    expect((data as FormData).get('seconds')).toBe('5')
    expect((data as FormData).get('authenticity_token')).toBe('csrf-token')
  })

  it("doesn't send a beacon when there's nothing to flush", () => {
    window.dispatchEvent(new Event('pagehide'))

    expect(sendBeacon).not.toHaveBeenCalled()
  })
})
