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
import {INK} from '../../self_paced_home/react/material'
import {Card, formatDate, muted} from './ui'

const I18n = createI18nScope('supports')

// GET /api/v1/supports/students/:id/applications (Supports::Application)
export type Applied = {
  id: string
  kind: 'extended_time' | 'extra_attempts' | 'pacing' | 'display'
  accommodation: string | null
  course: {id: string; name: string | null} | null
  quiz_title: string | null
  details: Record<string, string | number | boolean | null>
  created_at: string
}

type Response = {days: number; applications: Applied[]}

// What the app did for the student's accommodations lately
// (docs/teacher-workflow-plan.md Phase 2).
export default function AppliedCard({studentId}: {studentId: string}) {
  const [data, setData] = useState<Response | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    doFetchApi<Response>({
      path: `/api/v1/supports/students/${encodeURIComponent(studentId)}/applications`,
    })
      .then(({json}) => {
        if (!cancelled && json) setData(json)
      })
      .catch(() => {
        // not allowed: show nothing
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  if (!data) return null

  return (
    <Card id="supports-applied" title={I18n.t('Applied this week')}>
      {data.applications.length === 0 ? (
        <p style={{...muted, margin: 0}}>
          {I18n.t('Nothing was applied in the last %{count} days.', {count: data.days})}
        </p>
      ) : (
        <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
          {data.applications.map(row => (
            <li
              key={row.id}
              style={{padding: '8px 0', borderTop: '1px solid #E0E0E0', color: INK.primary}}
            >
              <div>{describe(row)}</div>
              <div style={muted}>
                {[formatDate(row.created_at), row.course?.name, row.accommodation]
                  .filter(Boolean)
                  .join(', ')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function describe(row: Applied): string {
  const quiz = row.quiz_title ?? I18n.t('a quiz')
  const details = row.details
  switch (row.kind) {
    case 'extended_time':
      return I18n.t('%{minutes} extra minutes on %{quiz}, attempt %{attempt}', {
        minutes: details.minutes,
        quiz,
        attempt: details.attempt,
      })
    case 'extra_attempts':
      return I18n.t('Extra attempts on %{quiz} raised to %{count}', {quiz, count: details.after})
    case 'pacing':
      return details.mode === 'lower_daily'
        ? I18n.t('Daily target lowered by %{percent}%; work spread to %{date}', {
            percent: details.percent,
            date: formatDate(String(details.spread_end)),
          })
        : I18n.t('Finish date moved to %{date}', {date: formatDate(String(details.target_date))})
    case 'display': {
      const setting =
        details.setting === 'high_contrast'
          ? I18n.t('High contrast display')
          : I18n.t('Dyslexia-friendly font')
      return details.already_on
        ? I18n.t('%{setting} was already on', {setting})
        : I18n.t('%{setting} turned on', {setting})
    }
    default:
      return ''
  }
}
