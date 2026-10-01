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
import {Button} from '@instructure/ui-buttons'
import {Checkbox} from '@instructure/ui-checkbox'
import {Flex} from '@instructure/ui-flex'
import {Heading} from '@instructure/ui-heading'
import {Link} from '@instructure/ui-link'
import {Pill} from '@instructure/ui-pill'
import {Spinner} from '@instructure/ui-spinner'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import type {QueueResult} from './types'

const I18n = createI18nScope('workflow_grading_queue')

const TIER_LABEL: Record<number, string> = {
  1: I18n.t('Holding a student up'),
  2: I18n.t('Could lock a student again'),
  3: I18n.t('Due soon'),
  4: I18n.t('Waiting'),
}

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
      <label htmlFor={id} style={{display: 'block', fontSize: '0.875rem'}}>
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
    <View as="div" padding="medium">
      <Heading level="h1">{I18n.t('Grading')}</Heading>
      {median !== null && (
        <Text as="p" size="small">
          {I18n.t('Your turnaround, last 30 days: median %{hours} hours', {
            hours: Math.round(median),
          })}
        </Text>
      )}
      <Flex gap="small" wrap="wrap" margin="0 0 small 0">
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
      </Flex>
      <Checkbox
        label={I18n.t('Held up only')}
        checked={heldUp}
        onChange={() => {
          setPage(1)
          setHeldUp(value => !value)
        }}
      />
      {result.truncated && (
        <Alert variant="info" margin="small 0">
          {I18n.t('Showing the first 500 waiting items.')}
        </Alert>
      )}
      {result.rows.length === 0 ? (
        <Text as="p">{I18n.t('Nothing is waiting for you to grade.')}</Text>
      ) : (
        <ul style={{listStyle: 'none', padding: 0}}>
          {result.rows.map(row => (
            <li key={row.id} style={{borderBottom: '1px solid #ddd', padding: '0.75rem 0'}}>
              <Flex gap="small" wrap="wrap" alignItems="center">
                <Pill color={row.tier <= 2 ? 'danger' : 'primary'}>{TIER_LABEL[row.tier]}</Pill>
                <Text weight="bold">{row.student.name}</Text>
              </Flex>
              <Text as="div">{row.reason}</Text>
              <Text as="div" size="small">
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
      <Flex gap="small">
        <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
          {I18n.t('Previous')}
        </Button>
        <Button
          disabled={page * result.per_page >= result.total}
          onClick={() => setPage(p => p + 1)}
        >
          {I18n.t('Next')}
        </Button>
      </Flex>
    </View>
  )
}
