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

import React, {useEffect, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import type {ScanBatch} from './types'
import {flatButton, formatDate, muted} from './ui'

const I18n = createI18nScope('supports')

type OpenBatch = {id: number; created_at: string; counts: ScanBatch['counts']; open: boolean}

// The person's recent batches that still have scans to deal with, so a batch
// can be picked up again after a reload. If the list can't be had, nothing shows.
export default function OpenBatches({
  accountId,
  onContinue,
}: {
  accountId: string
  onContinue: (batch: ScanBatch) => void
}) {
  const [batches, setBatches] = useState<OpenBatch[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    doFetchApi<{batches: OpenBatch[]}>({
      path: '/api/v1/supports/scan_batches',
      params: {account_id: accountId},
    })
      .then(({json}) => {
        if (!cancelled) setBatches((json?.batches ?? []).filter(batch => batch.open))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [accountId])

  const open = async (id: number) => {
    setBusy(true)
    try {
      const {json} = await doFetchApi<ScanBatch>({
        path: `/api/v1/supports/scan_batches/${id}`,
        params: {account_id: accountId},
      })
      if (json) onContinue(json)
    } catch {
      // stay on the list; the person can try again
    } finally {
      setBusy(false)
    }
  }

  if (batches.length === 0) return null
  return (
    <ul
      aria-label={I18n.t('Batches to continue')}
      style={{listStyle: 'none', margin: '0 0 12px', padding: 0}}
    >
      {batches.map(batch => {
        const waiting =
          batch.counts.reading + batch.counts.ready + batch.counts.failed + batch.counts.confirmed
        const date = formatDate(batch.created_at)
        return (
          <li
            key={batch.id}
            style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8}}
          >
            <span style={muted}>
              {waiting === 1
                ? I18n.t('Continue a batch: %{date} - 1 file waiting', {date})
                : I18n.t('Continue a batch: %{date} - %{count} files waiting', {
                    date,
                    count: waiting,
                  })}
            </span>
            <button
              type="button"
              style={flatButton}
              disabled={busy}
              aria-label={I18n.t('Continue the batch from %{date}', {date})}
              onClick={() => open(batch.id)}
            >
              {I18n.t('Continue')}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
