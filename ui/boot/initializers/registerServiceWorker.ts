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

// Registers public/service-worker.js, which makes the app installable and
// serves an offline page plus cached static assets. See that file for what is
// (and deliberately is not) cached.

const SERVICE_WORKER_URL = '/service-worker.js'
const INST_FS_WORKER = 'inst-fs-sw.js'

async function register() {
  // The Inst-FS worker (Safari only, see ui/features/inst_fs_service_worker)
  // uses the same scope, and only one worker can own it. Don't fight over it.
  const existing = await navigator.serviceWorker.getRegistration('/')
  const existingScript = (existing?.active || existing?.waiting || existing?.installing)?.scriptURL
  if (existingScript?.endsWith(INST_FS_WORKER)) return

  await navigator.serviceWorker.register(SERVICE_WORKER_URL, {scope: '/'})
}

export function up() {
  if (!('serviceWorker' in navigator)) return
  // Selenium and jest runs shouldn't have requests answered by a worker
  if (window.INST?.environment === 'test' || process.env.NODE_ENV === 'test') return

  // Wait for load so registering never competes with the page's own requests
  const start = () => {
    register().catch(e => {
      console.warn('Service worker registration failed', e)
    })
  }
  if (document.readyState === 'complete') {
    start()
  } else {
    window.addEventListener('load', start, {once: true})
  }
}
