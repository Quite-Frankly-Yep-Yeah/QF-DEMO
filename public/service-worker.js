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

/* PWA service worker.
 *
 * This is an authenticated app, so the rule is: cache only things that are the
 * same for everybody. Pages (HTML), /api/*, GraphQL and anything that is not a
 * GET are never stored; they always go to the network. What we do keep:
 *
 *  - /offline.html, shown when a page load fails because there is no network
 *  - content-hashed build output under /dist/, which can never change
 *  - fonts, images and the PWA icons, refreshed in the background
 *
 * Bump CACHE_VERSION to drop everything previously cached.
 */

/* eslint-disable no-restricted-globals */

const CACHE_VERSION = 'v1'
const PREFIX = 'qf-'
const OFFLINE_CACHE = `${PREFIX}offline-${CACHE_VERSION}`
const IMMUTABLE_CACHE = `${PREFIX}immutable-${CACHE_VERSION}`
const STATIC_CACHE = `${PREFIX}static-${CACHE_VERSION}`
const CURRENT_CACHES = [OFFLINE_CACHE, IMMUTABLE_CACHE, STATIC_CACHE]

const OFFLINE_URL = '/offline.html'
const MAX_ENTRIES = {[IMMUTABLE_CACHE]: 400, [STATIC_CACHE]: 150}

// e.g. /dist/webpack-production/foo-chunk-0123456789abcdef.js
const HASHED_BUILD_OUTPUT = /^\/dist\/.*[-./][0-9a-f]{10,}\.[a-z0-9]+$/i
const REFRESHED_STATIC = /^\/(fonts|images|pwa)\//

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then(cache => cache.add(new Request(OFFLINE_URL, {cache: 'reload'})))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(names =>
        Promise.all(
          names
            .filter(name => name.startsWith(PREFIX) && !CURRENT_CACHES.includes(name))
            .map(name => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const {request} = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkOrOfflinePage(request))
  } else if (HASHED_BUILD_OUTPUT.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMMUTABLE_CACHE))
  } else if (REFRESHED_STATIC.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, request, STATIC_CACHE))
  }
  // everything else falls through to the browser untouched
})

function networkOrOfflinePage(request) {
  return fetch(request).catch(() =>
    caches
      .match(OFFLINE_URL, {cacheName: OFFLINE_CACHE})
      .then(cached => cached || Response.error()),
  )
}

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(request).then(
      cached =>
        cached ||
        fetch(request).then(response => {
          if (isCacheable(response)) {
            cache.put(request, response.clone()).then(() => trim(cacheName))
          }
          return response
        }),
    ),
  )
}

function staleWhileRevalidate(event, request, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(request).then(cached => {
      const refresh = fetch(request).then(response => {
        if (isCacheable(response)) {
          cache.put(request, response.clone()).then(() => trim(cacheName))
        }
        return response
      })
      if (cached) {
        // keep the worker alive for the background refresh, but don't let its
        // failure (e.g. offline) surface anywhere
        event.waitUntil(refresh.catch(() => {}))
        return cached
      }
      return refresh
    }),
  )
}

function isCacheable(response) {
  // 'basic' excludes opaque/cross-origin responses; 206 (ranges) can't be put()
  return response.ok && response.type === 'basic' && response.status === 200
}

// Oldest entries first; cache.keys() returns them in insertion order
function trim(cacheName) {
  const max = MAX_ENTRIES[cacheName]
  return caches.open(cacheName).then(cache =>
    cache.keys().then(keys => {
      if (keys.length <= max) return undefined
      return Promise.all(keys.slice(0, keys.length - max).map(key => cache.delete(key)))
    }),
  )
}
