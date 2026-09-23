/*
 * Copyright (C) 2026 - present EXAMPLE contributors
 *
 * This file is part of EXAMPLE LMS, a modified version of Canvas.
 *
 * EXAMPLE LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import doFetchApi from '@canvas/do-fetch-api-effect'
import {startVideoTracking, WatchedSegments} from '../videoTracker'

vi.mock('@canvas/do-fetch-api-effect', () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({})),
}))

const mockFetch = vi.mocked(doFetchApi)

describe('WatchedSegments', () => {
  it('counts continuous playback', () => {
    const segments = new WatchedSegments(100)
    for (let t = 0; t <= 30; t++) segments.tick(t)

    expect(segments.watchedSeconds()).toBe(30)
    expect(segments.fraction()).toBeCloseTo(0.3)
  })

  it("doesn't count skipping ahead", () => {
    const segments = new WatchedSegments(100)
    segments.tick(0)
    segments.tick(1)
    segments.tick(90) // jumped

    expect(segments.watchedSeconds()).toBe(1)
  })

  it('counts rewatched parts once', () => {
    const segments = new WatchedSegments(100)
    for (let t = 0; t <= 20; t++) segments.tick(t)
    segments.stop()
    for (let t = 10; t <= 30; t++) segments.tick(t)

    expect(segments.watchedSeconds()).toBe(30)
  })

  it('starts a new stretch after a pause', () => {
    const segments = new WatchedSegments(100)
    segments.tick(5)
    segments.stop()
    segments.tick(6)

    expect(segments.watchedSeconds()).toBe(0)
  })
})

describe('startVideoTracking with an HTML5 video', () => {
  let video: HTMLVideoElement
  let stop: () => void
  let playhead = 0

  beforeEach(() => {
    mockFetch.mockClear()
    document.body.innerHTML = '<div id="content"><video></video></div>'
    video = document.querySelector('video') as HTMLVideoElement
    playhead = 0
    Object.defineProperty(video, 'duration', {configurable: true, get: () => 100})
    Object.defineProperty(video, 'paused', {configurable: true, get: () => false})
    Object.defineProperty(video, 'currentTime', {configurable: true, get: () => playhead})
    stop = startVideoTracking({
      url: '/api/v1/courses/4/self_paced/video_progress',
      moduleItemId: '12',
    })
  })

  afterEach(() => stop())

  function play(to: number) {
    for (; playhead <= to; playhead++) video.dispatchEvent(new Event('timeupdate'))
    playhead = to
  }

  it('reports the share watched as the student watches', () => {
    play(10)

    expect(mockFetch).toHaveBeenLastCalledWith({
      path: '/api/v1/courses/4/self_paced/video_progress',
      method: 'POST',
      body: {module_item_id: '12', fraction: '0.1000', duration: 100},
    })
  })

  it('reports in 5% steps rather than on every update', () => {
    play(12)

    expect(mockFetch).toHaveBeenCalledTimes(2) // at 5% and 10%
  })

  it('counts the student as active while the video plays', () => {
    const onActivity = vi.fn()
    document.addEventListener('self-paced-activity', onActivity)
    play(3)
    document.removeEventListener('self-paced-activity', onActivity)

    expect(onActivity).toHaveBeenCalled()
  })

  it('reports straight away when the video ends', () => {
    play(2)
    mockFetch.mockClear()
    video.dispatchEvent(new Event('ended'))

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
