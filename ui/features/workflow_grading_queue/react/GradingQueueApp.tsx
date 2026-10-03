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
import {Alert} from '@instructure/ui-alerts'
import {Checkbox} from '@instructure/ui-checkbox'
import {Flex} from '@instructure/ui-flex'
import {Link} from '@instructure/ui-link'
import {Pill} from '@instructure/ui-pill'
import {Spinner} from '@instructure/ui-spinner'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import {
  DIVIDER,
  ELEVATION,
  INK,
  ink,
  ON_APP_BAR,
  PALETTE,
  PAPER,
  ROBOTO,
  SURFACE,
} from '@canvas/material'
import {useMaterialPage} from '@canvas/material/useMaterialPage'
import {useThemeTokens} from '@canvas/material/useThemeTokens'
import type {QueueResult} from './types'

const I18n = createI18nScope('workflow_grading_queue')

const TIER_LABEL: Record<number, string> = {
  1: I18n.t('Holding a student up'),
  2: I18n.t('Could lock a student again'),
  3: I18n.t('Due soon'),
  4: I18n.t('Waiting'),
}

// red when a student is held up, orange when due soon, blue grey otherwise
const TIER_COLOR: Record<number, string> = {
  1: PALETTE[0],
  2: PALETTE[0],
  3: PALETTE[3],
  4: PALETTE[7],
}

const styles = (appBar: string) => `
.gq-page { min-height: 100vh; background: ${SURFACE}; font-family: ${ROBOTO}; color: ${INK.primary}; }
.gq-header { padding: 20px 24px; background: ${appBar}; color: ${ON_APP_BAR}; box-shadow: ${ELEVATION[4]}; }
.gq-header h1 { margin: 0; font-size: 1.5rem; font-weight: 500; }
.gq-header p { margin: 4px 0 0; opacity: 0.87; font-size: 0.875rem; }
.gq-body { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
.gq-card { margin: 0 0 16px; padding: 16px; border-radius: 4px; background: ${PAPER}; box-shadow: ${ELEVATION[1]}; }
.gq-filters { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; }
.gq-filters select { min-height: 36px; border: 0; border-bottom: 1px solid ${INK.secondary}; background: transparent; font: inherit; }
.gq-filters label { color: ${INK.secondary}; }
.gq-rows { margin: 0; padding: 0; list-style: none; }
.gq-row { margin: 0 0 16px; padding: 16px; border-left: 4px solid; border-radius: 4px; background: ${PAPER}; box-shadow: ${ELEVATION[2]}; transition: box-shadow 0.2s; }
.gq-row:hover { box-shadow: ${ELEVATION[4]}; }
.gq-meta { color: ${INK.secondary}; }
.gq-empty { padding: 32px; color: ${INK.secondary}; }
.gq-pager { display: flex; gap: 8px; }
.gq-pager button { min-height: 36px; padding: 0 16px; border: 0; border-radius: 4px; background: ${appBar}; box-shadow: ${ELEVATION[2]}; color: ${ON_APP_BAR}; cursor: pointer; font: inherit; font-weight: 500; text-transform: uppercase; }
.gq-pager button:hover:not(:disabled) { box-shadow: ${ELEVATION[4]}; }
.gq-pager button:disabled { background: ${DIVIDER}; box-shadow: none; color: ${INK.secondary}; cursor: default; }
`

type Option = {id: string; name: string}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (id: string) => void
}) {
  const id = `workflow-filter-${label.toLowerCase()}`
  return (
    <View as="div">
      <label htmlFor={id} style={{display: 'block', fontSize: '0.75rem'}}>
        {label}
      </label>
      <select id={id} value={value} onChange={event => onChange(event.target.value)}>
        <option value="">{I18n.t('All')}</option>
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </View>
  )
}

// The teacher's grading queue (docs/superpowers/specs/2026-10-01-grading-queue-design.md):
// the work waiting for them across their courses, held-up students first.
// Each row opens the real SpeedGrader.
export default function GradingQueueApp({queueUrl}: {queueUrl: string}) {
  useMaterialPage()
  const appBar = ink(useThemeTokens().appBar)
  const [heldUp, setHeldUp] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<QueueResult | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    setFailed(false)
    const params: Record<string, string | number | boolean> = {held_up: heldUp, page}
    if (courseId) params.course_id = courseId
    if (unitId) params.unit_id = unitId
    if (studentId) params.student_id = studentId
    doFetchApi<QueueResult>({path: queueUrl, params})
      .then(({json}) => current && setResult(json ?? null))
      .catch(() => current && setFailed(true))
    return () => {
      current = false
    }
  }, [queueUrl, heldUp, courseId, unitId, studentId, page])

  if (failed) {
    return (
      <Alert variant="error" margin="medium">
        {I18n.t('The grading queue could not be loaded.')}
      </Alert>
    )
  }
  if (!result) return <Spinner renderTitle={I18n.t('Loading')} />

  const turnarounds = Object.values(result.turnaround)
  const graded = turnarounds.reduce((sum, t) => sum + t.graded_count, 0)
  const median = graded
    ? turnarounds.reduce((sum, t) => sum + t.median_hours * t.graded_count, 0) / graded
    : null

  return (
    <div className="gq-page">
      <style>{styles(appBar)}</style>
      <header className="gq-header">
        <h1>{I18n.t('Grading')}</h1>
        {median !== null && (
          <p>
            {I18n.t('Your turnaround, last 30 days: median %{hours} hours', {
              hours: Math.round(median),
            })}
          </p>
        )}
      </header>
      <div className="gq-body">
        <div className="gq-card">
          <div className="gq-filters">
            <FilterSelect
              label={I18n.t('Course')}
              value={courseId}
              options={result.facets.courses}
              onChange={id => {
                setPage(1)
                setCourseId(id)
                // a unit from another course no longer applies
                const unit = result.facets.units.find(u => u.id === unitId)
                if (unit && id && unit.course_id !== id) setUnitId('')
              }}
            />
            <FilterSelect
              label={I18n.t('Unit')}
              value={unitId}
              options={result.facets.units.filter(u => !courseId || u.course_id === courseId)}
              onChange={id => {
                setPage(1)
                setUnitId(id)
              }}
            />
            <FilterSelect
              label={I18n.t('Student')}
              value={studentId}
              options={result.facets.students}
              onChange={id => {
                setPage(1)
                setStudentId(id)
              }}
            />
            <Checkbox
              label={I18n.t('Held up only')}
              checked={heldUp}
              onChange={() => {
                setPage(1)
                setHeldUp(value => !value)
              }}
            />
          </div>
        </div>
        {result.truncated && (
          <Alert variant="info" margin="small 0">
            {I18n.t('Showing the first 500 waiting items.')}
          </Alert>
        )}
        {result.rows.length === 0 ? (
          <div className="gq-card gq-empty">{I18n.t('Nothing is waiting for you to grade.')}</div>
        ) : (
          <ul className="gq-rows">
            {result.rows.map(row => (
              <li key={row.id} className="gq-row" style={{borderLeftColor: TIER_COLOR[row.tier]}}>
                <Flex gap="small" wrap="wrap" alignItems="center">
                  <Pill color={row.tier <= 2 ? 'danger' : 'primary'}>{TIER_LABEL[row.tier]}</Pill>
                  <Text weight="bold">{row.student.name}</Text>
                </Flex>
                <Text as="div">{row.reason}</Text>
                <Text as="div" size="small" className="gq-meta">
                  {[row.course.name, row.unit?.name, row.item.title].filter(Boolean).join(' · ')}
                  {row.submitted_at &&
                    ` · ${I18n.t('Submitted %{date}', {date: new Date(row.submitted_at).toLocaleDateString()})}`}
                  {row.due_at &&
                    ` · ${I18n.t('Due %{date}', {date: new Date(row.due_at).toLocaleDateString()})}`}
                </Text>
                <Link href={row.speed_grader_url}>
                  {I18n.t('Grade %{item}', {item: row.item.title})}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="gq-pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            {I18n.t('Previous')}
          </button>
          <button
            type="button"
            disabled={page * result.per_page >= result.total}
            onClick={() => setPage(p => p + 1)}
          >
            {I18n.t('Next')}
          </button>
        </div>
      </div>
    </div>
  )
}
