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
import {Button} from '@instructure/ui-buttons'
import {Text} from '@instructure/ui-text'
import {formatPlanDate, type Pacing} from '@canvas/self-paced/pacing'
import PaceBadge from '@canvas/self-paced/react/PaceBadge'
import PaceChart from '@canvas/self-paced/react/PaceChart'
import {INK} from './colors'
import {fillTemplate} from './format'
import {Card} from './material'

const I18n = createI18nScope('self_paced_dashboard')

type Props = {
  courseId: string
  studentId: string
  pacingUrl: string
  studentPacingUrl: string
  color: string
  onChanged: () => void
}

// A student's pace in the tray, and their target date for staff who can
// change it. Renders nothing for courses without pacing.
export default function PacingSection({
  courseId,
  studentId,
  pacingUrl,
  studentPacingUrl,
  color,
  onChanged,
}: Props) {
  const [pacing, setPacing] = useState<Pacing | null>(null)
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPacing(null)
    doFetchApi<Pacing>({
      path: fillTemplate(pacingUrl, {course_id: courseId, student_id: studentId}),
    })
      .then(({json}) => {
        // anything without a chart isn't a plan
        if (cancelled || !json?.chart) return
        setPacing(json)
        setTargetDate(json.target_date)
      })
      .catch(() => {
        // not paced, or not visible: the section stays out of the way
      })
    return () => {
      cancelled = true
    }
  }, [courseId, studentId, pacingUrl])

  if (!pacing) return null

  const save = async (body: Record<string, string | boolean>) => {
    setSaving(true)
    setError(null)
    try {
      const {json} = await doFetchApi<Pacing>({
        path: fillTemplate(studentPacingUrl, {course_id: courseId, student_id: studentId}),
        method: 'PUT',
        body,
      })
      if (json) {
        setPacing(json)
        setTargetDate(json.target_date)
      }
      onChanged()
    } catch {
      setError(I18n.t("The date wasn't saved. Check it and try again."))
    } finally {
      setSaving(false)
    }
  }

  const inputId = `self-paced-target-${courseId}-${studentId}`

  return (
    <Card level={3} title={I18n.t('Pace')} labelledBy={`${inputId}-heading`}>
      <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px'}}>
        <PaceBadge daysAhead={pacing.days_ahead} finished={pacing.finished} />
        <Text color="secondary" size="small">
          {I18n.t('%{done}% done, %{expected}% planned by now', {
            done: Math.round(pacing.percent_complete),
            expected: Math.round(pacing.expected_percent),
          })}
        </Text>
      </div>
      <div style={{margin: '8px 0 12px', color: INK.secondary}}>
        {pacing.target_source === 'teacher'
          ? I18n.t('Finishes by %{date} (a date set for this student)', {
              date: formatPlanDate(pacing.target_date),
            })
          : I18n.t("Finishes by %{date} (the course's date)", {
              date: formatPlanDate(pacing.target_date),
            })}
      </div>

      {pacing.can_adjust && (
        <form
          onSubmit={event => {
            event.preventDefault()
            if (targetDate) save({target_date: targetDate})
          }}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <label
            htmlFor={inputId}
            style={{display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 500}}
          >
            {I18n.t('Target date')}
            <input
              id={inputId}
              type="date"
              value={targetDate}
              min={pacing.start_date}
              onChange={event => setTargetDate(event.target.value)}
              style={{
                padding: '6px 8px',
                border: `1px solid ${INK.muted}`,
                borderRadius: 2,
                font: 'inherit',
              }}
            />
          </label>
          <Button
            type="submit"
            color="primary"
            interaction={saving || !targetDate ? 'disabled' : 'enabled'}
          >
            {I18n.t('Save date')}
          </Button>
          {pacing.target_source === 'teacher' && (
            <Button
              interaction={saving ? 'disabled' : 'enabled'}
              onClick={() => save({reset: true})}
            >
              {I18n.t("Use the course's date")}
            </Button>
          )}
          {error && (
            <div role="alert" style={{flexBasis: '100%'}}>
              <Text color="danger">{error}</Text>
            </div>
          )}
        </form>
      )}

      <PaceChart
        chart={pacing.chart}
        color={color}
        height={160}
        title={I18n.t('Progress against the plan')}
      />
    </Card>
  )
}
