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

import React, {useEffect, useMemo, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {INK} from '../../self_paced_home/react/material'
import PersonPicker from './PersonPicker'
import type {CaseloadRow} from './types'
import {BRAND, button, Card, field, flatButton, formatDate, Label, muted} from './ui'

const I18n = createI18nScope('supports')

const soon = (iso: string | null) => {
  if (!iso) return false
  const days = (new Date(`${iso}T00:00:00`).getTime() - Date.now()) / 86_400_000
  return days <= 30
}

// The students the viewer supports: their assigned caseload, or every student
// with a plan for people who can see all of them.
export default function CaseloadPanel({
  canSeeAll,
  onOpen,
}: {
  canSeeAll: boolean
  onOpen: (studentId: string) => void
}) {
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [rows, setRows] = useState<CaseloadRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setFailed(false)
    doFetchApi<{rows: CaseloadRow[]}>({path: '/api/v1/supports/caseload', params: {scope}})
      .then(({json}) => {
        if (!cancelled) setRows(json?.rows ?? [])
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [scope])

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase()
    return (rows ?? []).filter(row => !term || row.student.name.toLowerCase().includes(term))
  }, [rows, filter])

  const scopeButton = (value: 'mine' | 'all', text: string) => (
    <button
      type="button"
      aria-pressed={scope === value}
      style={{
        ...flatButton,
        background: scope === value ? BRAND : 'transparent',
        color: scope === value ? '#fff' : BRAND,
      }}
      onClick={() => setScope(value)}
    >
      {text}
    </button>
  )

  return (
    <div style={{display: 'grid', gap: 'clamp(12px, 3vw, 20px)'}}>
      <Card
        id="supports-caseload"
        title={I18n.t('Caseload')}
        aside={
          canSeeAll ? (
            <div
              role="group"
              aria-label={I18n.t('Whose students')}
              style={{display: 'flex', gap: 4}}
            >
              {scopeButton('mine', I18n.t('Mine'))}
              {scopeButton('all', I18n.t('All with a plan'))}
            </div>
          ) : null
        }
      >
        <Label text={I18n.t('Find a student')}>
          <input
            style={{...field, maxWidth: '24rem'}}
            value={filter}
            onChange={event => setFilter(event.target.value)}
          />
        </Label>
        {failed && (
          <p role="alert">{I18n.t("The caseload didn't load. Reload the page to try again.")}</p>
        )}
        {!failed && !rows && <p>{I18n.t('Loading...')}</p>}
        {rows && shown.length === 0 && (
          <p style={muted}>
            {rows.length === 0
              ? I18n.t('No students yet. An administrator or case manager assigns students to you.')
              : I18n.t('No students match.')}
          </p>
        )}
        {shown.length > 0 && (
          <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
            {shown.map(row => (
              <li key={row.student.id} style={{borderTop: '1px solid rgba(0,0,0,0.12)'}}>
                <button
                  type="button"
                  onClick={() => onOpen(row.student.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))',
                    gap: '4px 16px',
                    width: '100%',
                    minHeight: 56,
                    padding: '10px 4px',
                    border: 'none',
                    background: 'transparent',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{fontWeight: 500, color: BRAND}}>{row.student.name}</span>
                  <span>
                    {row.plans.length === 0
                      ? I18n.t('No plan yet')
                      : row.plans.map(plan => plan.type_label).join(', ')}
                  </span>
                  <span style={{color: soon(row.next_review) ? '#B71C1C' : INK.secondary}}>
                    {row.next_review
                      ? I18n.t('Review %{date}', {date: formatDate(row.next_review)})
                      : I18n.t('No review date')}
                  </span>
                  <span style={muted}>
                    {I18n.t(
                      {one: '1 accommodation', other: '%{count} accommodations'},
                      {count: row.accommodations},
                    )}
                    {row.unacknowledged > 0
                      ? `. ${I18n.t(
                          {
                            one: '1 teacher has not read it',
                            other: '%{count} teachers have not read it',
                          },
                          {count: row.unacknowledged},
                        )}`
                      : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canSeeAll && <StartPlan onOpen={onOpen} />}
    </div>
  )
}

// For people who manage every student's plans: find any student in their
// schools and open them to start a plan.
function StartPlan({onOpen}: {onOpen: (studentId: string) => void}) {
  const [student, setStudent] = useState<{id: string; name: string} | null>(null)
  return (
    <Card id="supports-start" title={I18n.t('Start a plan for another student')}>
      <div style={{maxWidth: '28rem'}}>
        <PersonPicker
          label={I18n.t('Student')}
          url="/api/v1/supports/students"
          resultKey="students"
          selected={student}
          onSelect={setStudent}
        />
        {student && (
          <button type="button" style={button} onClick={() => onOpen(student.id)}>
            {I18n.t('Open %{name}', {name: student.name})}
          </button>
        )}
      </div>
    </Card>
  )
}
