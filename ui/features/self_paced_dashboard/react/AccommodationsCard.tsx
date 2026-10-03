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

import React, {useCallback, useEffect, useRef, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {Button} from '@instructure/ui-buttons'
import {INK} from './colors'
import {Card, DIVIDER} from './material'

const I18n = createI18nScope('self_paced_dashboard')

// GET /api/v1/supports/students/:id/accommodations (Supports::AccommodationCard)
export type CardAccommodation = {
  id: number
  name: string
  kind: string
  details: string | null
  instructions: string | null
  teacher_note: string | null
  courses: {id: number; name: string | null}[] | null
  start_date: string | null
  end_date: string | null
}

export type AccommodationCardData = {
  student: {id: string; name: string}
  accommodations: CardAccommodation[]
  acknowledged: boolean
  can_manage: boolean
}

const cardUrl = (studentId: string) =>
  `/api/v1/supports/students/${encodeURIComponent(studentId)}/accommodations`

// The student's accommodations for their teacher (docs/teacher-workflow-plan.md
// Phase 1). Renders nothing unless the viewer may see them, so it never says
// whether the student has a plan. Opening it is logged on the server.
export default function AccommodationsCard({
  studentId,
  onLoad,
}: {
  studentId: string
  // the kinds of accommodation the student has, for the tray's actions
  onLoad?: (kinds: string[]) => void
}) {
  const [data, setData] = useState<AccommodationCardData | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad

  useEffect(() => {
    let cancelled = false
    setData(null)
    onLoadRef.current?.([])
    doFetchApi<AccommodationCardData>({path: cardUrl(studentId)})
      .then(({json}) => {
        if (cancelled || !json) return
        setData(json)
        onLoadRef.current?.(json.accommodations.map(accommodation => accommodation.kind))
      })
      .catch(() => {
        // not allowed, or the feature is off: show nothing
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  const acknowledge = useCallback(async () => {
    setBusy(true)
    setFailed(false)
    try {
      const {json} = await doFetchApi<AccommodationCardData>({
        path: `/api/v1/supports/students/${encodeURIComponent(studentId)}/acknowledgement`,
        method: 'POST',
      })
      if (json) setData(json)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [studentId])

  if (!data || data.accommodations.length === 0) return null

  return (
    <Card
      level={3}
      title={I18n.t('Accommodations')}
      labelledBy="self-paced-tray-accommodations"
      aside={
        data.can_manage ? (
          <a href={`/supports?student_id=${encodeURIComponent(studentId)}`}>
            {I18n.t('Open plan')}
          </a>
        ) : null
      }
    >
      <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
        {data.accommodations.map(row => (
          <li
            key={row.id}
            data-testid="accommodation-row"
            style={{padding: '10px 0', borderTop: `1px solid ${DIVIDER}`}}
          >
            <div style={{fontWeight: 500, color: INK.primary}}>{row.name}</div>
            {row.details && <div>{row.details}</div>}
            {row.instructions && (
              <div style={{color: INK.secondary, fontSize: '0.875rem'}}>{row.instructions}</div>
            )}
            {row.teacher_note && (
              <div style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 4}}>
                {row.teacher_note}
              </div>
            )}
            <div style={{color: INK.muted, fontSize: '0.8125rem', marginTop: 4}}>
              {row.courses
                ? I18n.t('In %{courses}', {
                    courses: row.courses.map(course => course.name ?? '').join(', '),
                  })
                : I18n.t('In all classes')}
              {row.end_date ? `. ${I18n.t('Until %{date}.', {date: row.end_date})}` : ''}
            </div>
          </li>
        ))}
      </ul>
      <div style={{marginTop: 8}}>
        {data.acknowledged ? (
          <span style={{color: INK.secondary}}>{I18n.t('You have read this list.')}</span>
        ) : (
          <Button color="primary" interaction={busy ? 'disabled' : 'enabled'} onClick={acknowledge}>
            {I18n.t('I have read these accommodations')}
          </Button>
        )}
        {failed && (
          <p role="alert" style={{margin: '8px 0 0'}}>
            {I18n.t("That didn't save. Please try again.")}
          </p>
        )}
      </div>
    </Card>
  )
}
