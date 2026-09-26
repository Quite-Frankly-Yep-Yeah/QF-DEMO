/*
 * Copyright (C) 2026 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

// Behaviour half of components/_material_motion.scss: a top progress bar that
// starts the moment something slow might be happening, and tap ripples.

const REQUEST_SHOW_DELAY_MS = 150
const MIN_VISIBLE_MS = 400
const REQUEST_MAX_TRACK_MS = 20000
const SPA_NAVIGATION_MS = 700
const FULL_NAVIGATION_MAX_MS = 10000
const RIPPLE_MAX_HEIGHT_PX = 140
const RIPPLE_CLEANUP_MS = 800

const RIPPLE_COLORS = [
  'rgba(33, 150, 243, 0.35)',
  'rgba(233, 30, 99, 0.35)',
  'rgba(255, 193, 7, 0.45)',
  'rgba(76, 175, 80, 0.35)',
  'rgba(156, 39, 176, 0.35)',
  'rgba(255, 87, 34, 0.35)',
]

const RIPPLE_SELECTOR = [
  'button',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '.btn',
  '.Button',
  '.ui-tabs-anchor',
  '.ui-menu-item > a',
  '.al-options a',
  '.ic-app-header__menu-list-link',
  '.ig-row',
].join(',')

// Links that lead to a file rather than a page never unload the document, so
// treating them as navigation would leave the page dimmed.
const FILE_LINK = /\/download\b|[?&]download|\.(pdf|zip|csv|docx?|xlsx?|pptx?|png|jpe?g|gif|mp[34])(\?|#|$)/i

let bar: HTMLElement | null = null
let visible = false
let visibleSince = 0
let requests = 0
let navigating = false
let showTimer: number | undefined
let hideTimer: number | undefined
let navTimer: number | undefined
let rippleCount = 0

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function ensureBar(): HTMLElement {
  if (!bar) {
    bar = document.createElement('div')
    bar.className = 'mm-progress'
    bar.setAttribute('aria-hidden', 'true')
    document.body.appendChild(bar)
  }
  return bar
}

function show() {
  window.clearTimeout(hideTimer)
  if (visible) return
  visible = true
  visibleSince = Date.now()
  ensureBar().classList.add('mm-active')
  document.body.classList.add('mm-busy')
}

// Once shown, stay up long enough to be seen; a bar that flashes for 30ms
// looks like a glitch rather than progress.
function hideWhenIdle() {
  if (!visible || navigating || requests > 0) return
  window.clearTimeout(hideTimer)
  const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - visibleSince))
  hideTimer = window.setTimeout(() => {
    if (navigating || requests > 0) return
    visible = false
    bar?.classList.remove('mm-active')
    document.body.classList.remove('mm-busy')
  }, remaining)
}

function startNavigation(dimPage: boolean, maxMs: number) {
  navigating = true
  show()
  if (dimPage) document.body.classList.add('mm-leaving')
  window.clearTimeout(navTimer)
  navTimer = window.setTimeout(stopNavigation, maxMs)
}

function stopNavigation() {
  window.clearTimeout(navTimer)
  navigating = false
  document.body.classList.remove('mm-leaving')
  hideWhenIdle()
}

function trackRequest() {
  requests++
  if (!visible && showTimer === undefined) {
    showTimer = window.setTimeout(() => {
      showTimer = undefined
      if (requests > 0) show()
    }, REQUEST_SHOW_DELAY_MS)
  }

  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    window.clearTimeout(giveUp)
    requests = Math.max(0, requests - 1)
    if (requests === 0) {
      window.clearTimeout(showTimer)
      showTimer = undefined
      hideWhenIdle()
    }
  }
  // Never let one request that hangs forever keep the bar up
  const giveUp = window.setTimeout(finish, REQUEST_MAX_TRACK_MS)
  return finish
}

function isPlainLeftClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

function onLinkClick(e: MouseEvent) {
  if (!isPlainLeftClick(e) || !(e.target instanceof Element)) return
  const link = e.target.closest('a[href]') as HTMLAnchorElement | null
  if (!link || link.target === '_blank' || link.hasAttribute('download')) return

  const href = link.getAttribute('href') || ''
  if (href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) return
  let url: URL
  try {
    url = new URL(link.href, window.location.href)
  } catch (_e) {
    return
  }
  if (url.origin !== window.location.origin || FILE_LINK.test(url.pathname + url.search)) return
  if (url.pathname === window.location.pathname && url.search === window.location.search) return

  // Other handlers (React Router, jQuery) run after us, so wait a tick to find
  // out whether they took over navigation.
  window.setTimeout(() => {
    if (e.defaultPrevented) {
      startNavigation(false, SPA_NAVIGATION_MS)
    } else {
      startNavigation(true, FULL_NAVIGATION_MAX_MS)
    }
  }, 0)
}

function onFormSubmit(e: SubmitEvent) {
  const form = e.target
  if (!(form instanceof HTMLFormElement) || form.target === '_blank') return
  window.setTimeout(() => {
    if (e.defaultPrevented) return
    startNavigation(true, FULL_NAVIGATION_MAX_MS)
  }, 0)
}

function onPointerDown(e: PointerEvent) {
  if (!e.isPrimary || e.button !== 0 || !(e.target instanceof Element)) return
  const el = e.target.closest(RIPPLE_SELECTOR) as HTMLElement | null
  if (!el || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return

  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0 || rect.height > RIPPLE_MAX_HEIGHT_PX) return

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  // Big enough to reach the farthest corner
  const diameter = 2 * Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y))

  const wrap = document.createElement('span')
  wrap.className = 'mm-ripple-wrap'
  wrap.style.left = `${rect.left}px`
  wrap.style.top = `${rect.top}px`
  wrap.style.width = `${rect.width}px`
  wrap.style.height = `${rect.height}px`
  wrap.style.borderRadius = getComputedStyle(el).borderRadius

  const ripple = document.createElement('span')
  ripple.className = 'mm-ripple'
  ripple.style.setProperty('--mm-x', `${x}px`)
  ripple.style.setProperty('--mm-y', `${y}px`)
  ripple.style.setProperty('--mm-d', `${diameter}px`)
  ripple.style.setProperty('--mm-color', RIPPLE_COLORS[rippleCount++ % RIPPLE_COLORS.length])

  wrap.appendChild(ripple)
  document.body.appendChild(wrap)
  ripple.addEventListener('animationend', () => wrap.remove(), {once: true})
  window.setTimeout(() => wrap.remove(), RIPPLE_CLEANUP_MS)
}

function watchRequests() {
  const send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args) {
    const finish = trackRequest()
    if (finish) this.addEventListener('loadend', finish, {once: true})
    return send.apply(this, args as Parameters<XMLHttpRequest['send']>)
  }

  const fetch = window.fetch
  window.fetch = function (this: unknown, ...args: Parameters<typeof window.fetch>) {
    const finish = trackRequest()
    const promise = fetch.apply(window, args)
    // Both handlers given so this side branch never reports an unhandled
    // rejection; the caller still gets the original promise.
    if (finish) promise.then(finish, finish)
    return promise
  }
}

export function up() {
  if (prefersReducedMotion()) return

  document.addEventListener('click', onLinkClick)
  document.addEventListener('submit', onFormSubmit)
  document.addEventListener('pointerdown', onPointerDown, {passive: true})

  // Back/forward can restore this page from the bfcache still mid-navigation
  window.addEventListener('pageshow', stopNavigation)

  // Selenium counts in-flight requests itself and wraps the same functions
  if (window.INST?.environment !== 'test' && process.env.NODE_ENV !== 'test') {
    watchRequests()
  }
}
