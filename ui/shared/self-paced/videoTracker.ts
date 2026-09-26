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

// Video completion for the course player (docs/fork-plan.md §2.9,
// docs/spikes/video-tracking.md).
//
// Counts the stretches of each video that actually played, so skipping ahead
// doesn't count, and reports the share watched across all videos on the page.
// Only the highest share is kept on the server. While a video plays, the
// activity pinger counts the student as active.

// Playhead jumps bigger than this between two updates are a seek, not playback.
const MAX_GAP_SECONDS = 2
// Report again once another 5% has been watched, and when a video ends.
const REPORT_STEP = 0.05

export class WatchedSegments {
  duration: number
  private segments: Array<[number, number]> = []
  private last: number | null = null

  constructor(duration = 0) {
    this.duration = duration
  }

  // Called while playing with the current playhead position.
  tick(time: number) {
    if (this.last !== null && time >= this.last && time - this.last <= MAX_GAP_SECONDS) {
      this.add(this.last, time)
    }
    this.last = time
  }

  // A pause or seek breaks continuity: the next tick starts a new stretch.
  stop() {
    this.last = null
  }

  watchedSeconds(): number {
    return this.segments.reduce((sum, [start, end]) => sum + (end - start), 0)
  }

  fraction(): number {
    return this.duration > 0 ? Math.min(1, this.watchedSeconds() / this.duration) : 0
  }

  private add(start: number, end: number) {
    if (end <= start) return
    const merged: Array<[number, number]> = []
    let [s, e] = [start, end]
    for (const [a, b] of this.segments) {
      if (b < s || a > e) merged.push([a, b])
      else [s, e] = [Math.min(a, s), Math.max(b, e)]
    }
    merged.push([s, e])
    this.segments = merged.sort((x, y) => x[0] - y[0])
  }
}

export type VideoTrackingConfig = {url: string; moduleItemId: string}

type YTPlayer = {getCurrentTime(): number; getDuration(): number}
type YTNamespace = {
  Player: new (el: HTMLIFrameElement, opts: object) => YTPlayer
  PlayerState: {PLAYING: number}
}

export function startVideoTracking(
  config: VideoTrackingConfig,
  root: ParentNode = document,
): () => void {
  const sources: WatchedSegments[] = []
  const cleanups: Array<() => void> = []
  let lastReported = 0

  const markActive = () => document.dispatchEvent(new Event('self-paced-activity'))

  const report = (force = false) => {
    const total = sources.reduce((sum, s) => sum + s.duration, 0)
    if (total <= 0) return
    const watched = sources.reduce((sum, s) => sum + Math.min(s.watchedSeconds(), s.duration), 0)
    const fraction = Math.min(1, watched / total)
    if (!force && fraction - lastReported < REPORT_STEP) return
    lastReported = Math.max(lastReported, fraction)
    doFetchApi({
      path: config.url,
      method: 'POST',
      body: {
        module_item_id: config.moduleItemId,
        fraction: fraction.toFixed(4),
        duration: Math.round(total),
      },
    }).catch(() => {
      // best effort; the next report catches up
    })
  }

  const trackHtml5 = (video: HTMLVideoElement) => {
    const segments = new WatchedSegments(Number.isFinite(video.duration) ? video.duration : 0)
    sources.push(segments)
    const onMeta = () => {
      if (Number.isFinite(video.duration)) segments.duration = video.duration
    }
    const onTime = () => {
      if (video.paused) return
      if (!segments.duration) onMeta()
      segments.tick(video.currentTime)
      markActive()
      report()
    }
    const onBreak = () => segments.stop()
    const onEnded = () => {
      segments.stop()
      report(true)
    }
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('seeking', onBreak)
    video.addEventListener('pause', onBreak)
    video.addEventListener('ended', onEnded)
    cleanups.push(() => {
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('seeking', onBreak)
      video.removeEventListener('pause', onBreak)
      video.removeEventListener('ended', onEnded)
    })
  }

  // YouTube: the IFrame API needs enablejsapi=1 on the embed.
  const trackYouTube = (iframe: HTMLIFrameElement) => {
    const src = new URL(iframe.src, window.location.href)
    if (src.searchParams.get('enablejsapi') !== '1') {
      src.searchParams.set('enablejsapi', '1')
      src.searchParams.set('origin', window.location.origin)
      iframe.src = src.toString()
    }
    const segments = new WatchedSegments()
    sources.push(segments)
    let timer: number | undefined
    withYouTubeApi(YT => {
      const player: YTPlayer = new YT.Player(iframe, {
        events: {
          onStateChange: (event: {data: number}) => {
            window.clearInterval(timer)
            segments.stop()
            if (event.data === YT.PlayerState.PLAYING) {
              timer = window.setInterval(() => {
                segments.duration = player.getDuration() || segments.duration
                segments.tick(player.getCurrentTime())
                markActive()
                report()
              }, 1000)
            } else if (event.data === 0) {
              report(true) // ended
            }
          },
        },
      })
    })
    cleanups.push(() => window.clearInterval(timer))
  }

  // Vimeo: the player's postMessage API.
  const trackVimeo = (iframe: HTMLIFrameElement) => {
    const segments = new WatchedSegments()
    sources.push(segments)
    const post = (method: string, value?: string) =>
      iframe.contentWindow?.postMessage(JSON.stringify(value ? {method, value} : {method}), '*')
    const subscribe = () =>
      ['timeupdate', 'pause', 'seeked', 'ended'].forEach(e => post('addEventListener', e))
    const onMessage = (message: MessageEvent) => {
      if (
        message.source !== iframe.contentWindow ||
        !/vimeo\.com$/.test(new URL(message.origin).hostname)
      )
        return
      let data: {event?: string; data?: {seconds?: number; duration?: number}}
      try {
        data = typeof message.data === 'string' ? JSON.parse(message.data) : message.data
      } catch {
        return
      }
      if (data.event === 'ready') subscribe()
      if (data.event === 'timeupdate' && data.data) {
        segments.duration = data.data.duration || segments.duration
        segments.tick(data.data.seconds || 0)
        markActive()
        report()
      }
      if (data.event === 'pause' || data.event === 'seeked') segments.stop()
      if (data.event === 'ended') report(true)
    }
    window.addEventListener('message', onMessage)
    iframe.addEventListener('load', subscribe)
    subscribe()
    cleanups.push(() => window.removeEventListener('message', onMessage))
  }

  root.querySelectorAll<HTMLVideoElement>('video').forEach(trackHtml5)
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach(iframe => {
    const src = iframe.getAttribute('src') || ''
    if (/youtube(-nocookie)?\.com\/embed\//.test(src)) trackYouTube(iframe)
    else if (/player\.vimeo\.com\/video\//.test(src)) trackVimeo(iframe)
    else if (/media_attachments_iframe|media_objects_iframe/.test(src)) {
      // quite frankly an example LMS media plays in a same-origin iframe; follow its <video> directly
      const attach = () => iframe.contentDocument?.querySelectorAll('video').forEach(trackHtml5)
      iframe.addEventListener('load', attach)
      attach()
    }
  })

  const heartbeat = window.setInterval(() => report(), 15000)
  cleanups.push(() => window.clearInterval(heartbeat))

  return () => cleanups.forEach(cleanup => cleanup())
}

let youTubeCallbacks: Array<(yt: YTNamespace) => void> | null = null

function withYouTubeApi(callback: (yt: YTNamespace) => void) {
  const win = window as unknown as {
    YT?: YTNamespace & {loaded?: number}
    onYouTubeIframeAPIReady?: () => void
  }
  if (win.YT?.Player) {
    callback(win.YT)
    return
  }
  if (youTubeCallbacks) {
    youTubeCallbacks.push(callback)
    return
  }
  youTubeCallbacks = [callback]
  const previous = win.onYouTubeIframeAPIReady
  win.onYouTubeIframeAPIReady = () => {
    previous?.()
    youTubeCallbacks?.forEach(cb => cb(win.YT as YTNamespace))
    youTubeCallbacks = null
  }
  const script = document.createElement('script')
  script.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(script)
}
