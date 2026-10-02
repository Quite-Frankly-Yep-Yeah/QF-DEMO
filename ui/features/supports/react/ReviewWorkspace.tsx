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

import React, {useEffect, useRef, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {ELEVATION, INK, tint} from '../../self_paced_home/react/material'
import ScanCard from './ScanCard'
import type {ReviewEdits, ScanRecord} from './types'
import {BRAND, button, Card, field, flatButton, Label, messageFrom, muted, Status} from './ui'
import {PAPER, WARNING_BG} from '@canvas/material'

const I18n = createI18nScope('supports')

const PLAN_TYPES = [
  {value: 'iep', label: 'IEP'},
  {value: '504', label: '504 plan'},
  {value: 'el', label: 'English-learner plan'},
  {value: 'other', label: 'Other plan'},
]

// Narrower than this the queue becomes a stepper and the columns stack.
const NARROW = '(max-width: 48rem)'

// Why Apply is off, in words; null when it can be used.
export function applyBlocker(record: ScanRecord): string | null {
  const scan = record.scan
  if (!scan.plan_type) return I18n.t('Choose a plan type.')
  if ((record.summary.blocking ?? 0) > 0) return I18n.t('Fix the items marked with problems first.')
  if (scan.mismatch && !scan.acknowledged_mismatch) {
    return I18n.t('Confirm that this is the right student first.')
  }
  return null
}

function useNarrow(): boolean {
  const query = () => (typeof window.matchMedia === 'function' ? window.matchMedia(NARROW) : null)
  const [narrow, setNarrow] = useState(() => !!query()?.matches)
  useEffect(() => {
    const list = query()
    if (!list) return undefined
    const update = () => setNarrow(list.matches)
    update()
    list.addEventListener?.('change', update)
    return () => list.removeEventListener?.('change', update)
  }, [])
  return narrow
}

const toReview = (record: ScanRecord) =>
  record.workflow_state === 'previewed' && !!record.student && record.extraction_state === 'ready'

const statusLabel = (record: ScanRecord) => {
  switch (record.workflow_state) {
    case 'applied':
      return I18n.t('Applied')
    case 'discarded':
      return I18n.t('Skipped')
    case 'undone':
      return I18n.t('Undone')
    default:
      return I18n.t('To review')
  }
}

const nameOf = (record: ScanRecord) => record.student?.name ?? record.filename ?? ''

// Stage 2: check one scan at a time. On the left the queue (when there is
// more than one scan) above a summary of this scan; on the right what it found
// (each accommodation with the words it came from, and what could not be
// matched). Nothing is saved until Apply.
export default function ReviewWorkspace({
  records,
  currentId,
  accountId,
  single = records.length === 1,
  onSelect,
  onChange,
  onBack,
}: {
  records: ScanRecord[]
  currentId: number
  accountId: string
  // one scan on its own: Apply and Discard, no queue, "Scan another" at the end
  single?: boolean
  onSelect: (id: number) => void
  onChange: (record: ScanRecord) => void
  // +message+ says what just finished, for the page it returns to
  onBack: (message?: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const narrow = useNarrow()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const moveFocus = useRef(false)

  const current = records.find(record => record.id === currentId) ?? null
  const showing = current && current.workflow_state !== 'discarded' ? current : null
  const position = current ? records.indexOf(current) + 1 : 0

  // After Apply & next or Skip the new scan's heading takes focus.
  useEffect(() => {
    if (moveFocus.current && showing) {
      moveFocus.current = false
      headingRef.current?.focus()
    }
  }, [showing?.id])

  const act = async (
    record: ScanRecord,
    suffix: string,
    method: 'PUT' | 'POST' | 'DELETE',
    body?: ReviewEdits,
  ): Promise<ScanRecord | null> => {
    setBusy(true)
    setMessage('')
    try {
      const {json} = await doFetchApi<ScanRecord>({
        path: `/api/v1/supports/imports/${record.id}${suffix}?account_id=${accountId}`,
        method,
        body,
      })
      if (!json) return null
      const next = method === 'DELETE' ? {...json, workflow_state: 'discarded' as const} : json
      onChange(next)
      return next
    } catch (error) {
      setMessage(await messageFrom(error))
      return null
    } finally {
      setBusy(false)
    }
  }

  const edit = (edits: ReviewEdits) => showing && act(showing, '/review', 'PUT', edits)

  // the next scan still to review after +done+, looking on past it and round
  const following = (done: ScanRecord) => {
    const after = records.map(record => (record.id === done.id ? done : record))
    const at = after.findIndex(record => record.id === done.id)
    return [...after.slice(at + 1), ...after.slice(0, at)].find(toReview) ?? null
  }

  const moveOn = (done: ScanRecord, said: string) => {
    const next = following(done)
    if (!next) {
      onBack(I18n.t('%{said} That was the last scan to review.', {said}))
      return
    }
    moveFocus.current = true
    onSelect(next.id)
    setMessage(
      I18n.t('%{said} Now reviewing %{name}, %{number} of %{total}.', {
        said,
        name: nameOf(next),
        number: records.indexOf(next) + 1,
        total: records.length,
      }),
    )
  }

  const apply = async () => {
    if (!showing) return
    const done = await act(showing, '/apply', 'POST')
    if (!done) return
    if (single) setMessage(I18n.t('Applied. The plan and its accommodations are saved.'))
    else moveOn(done, I18n.t('Applied.'))
  }

  const skip = async () => {
    if (!showing) return
    const done = await act(showing, '', 'DELETE')
    if (done && !single) moveOn(done, I18n.t('Skipped.'))
  }

  const undo = async () => {
    if (!showing) return
    if (await act(showing, '/undo', 'POST'))
      setMessage(I18n.t('Undone. The plan is back as it was.'))
  }

  const select = (record: ScanRecord) => {
    onSelect(record.id)
    setMessage(
      I18n.t('Reviewing %{name}, %{number} of %{total}.', {
        name: nameOf(record),
        number: records.indexOf(record) + 1,
        total: records.length,
      }),
    )
  }

  const back = () => onBack()

  if (!showing) {
    return (
      <div>
        <p style={{margin: '0 0 12px', fontWeight: 500, color: INK.primary}}>
          {I18n.t('Nothing left to review.')}
        </p>
        <button type="button" style={flatButton} onClick={back}>
          {single ? I18n.t('Scan another') : I18n.t('Back to matches')}
        </button>
        <Status message={message} />
      </div>
    )
  }

  const scan = showing.scan
  const previewing = showing.workflow_state === 'previewed'
  const blocker = applyBlocker(showing)
  const unmapped = scan.unmapped ?? []
  const kept = scan.keep_unmapped ?? []
  const off = busy || !previewing
  const hasQueue = !single && records.length > 1

  const toggleKept = (index: number, keep: boolean) =>
    edit({
      keep_unmapped: keep ? [...kept, index].sort((a, b) => a - b) : kept.filter(i => i !== index),
    })

  const queue = (
    <Card id="scan-queue" title={I18n.t('Scans')}>
      <ol
        aria-label={I18n.t('Scans in this batch')}
        style={{listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4}}
      >
        {records.map(record => {
          const isCurrent = record.id === showing.id
          return (
            <li key={record.id}>
              <button
                type="button"
                aria-current={isCurrent ? 'true' : undefined}
                disabled={busy}
                onClick={() => select(record)}
                style={{
                  ...flatButton,
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  textTransform: 'none',
                  letterSpacing: 0,
                  color: INK.primary,
                  padding: '6px 12px',
                  borderLeft: `4px solid ${isCurrent ? BRAND : 'transparent'}`,
                  background: isCurrent ? tint(BRAND, 0.1) : 'transparent',
                }}
              >
                <span style={{display: 'block', fontWeight: 500}}>{nameOf(record)}</span>
                <span style={{display: 'block', ...muted}}>{record.filename}</span>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: 2,
                    padding: '0 8px',
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    background: tint(record.workflow_state === 'applied' ? '#008300' : BRAND, 0.14),
                    color: INK.primary,
                  }}
                >
                  {statusLabel(record)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </Card>
  )

  const stepper = (
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <button
        type="button"
        style={flatButton}
        disabled={busy || position <= 1}
        onClick={() => select(records[position - 2])}
      >
        {I18n.t('Previous scan')}
      </button>
      <span style={{fontWeight: 500, color: INK.primary}}>
        {I18n.t('%{number} of %{total}', {number: position, total: records.length})}
      </span>
      <button
        type="button"
        style={flatButton}
        disabled={busy || position >= records.length}
        onClick={() => select(records[position])}
      >
        {I18n.t('Next scan')}
      </button>
    </div>
  )

  const summary = (
    <Card id="scan-summary" title={I18n.t('Summary')}>
      {previewing && scan.mismatch && (
        <div
          role="alert"
          style={{
            background: WARNING_BG,
            borderLeft: '4px solid #E65100',
            borderRadius: 2,
            boxShadow: ELEVATION[2],
            padding: '12px 16px',
            margin: '0 0 12px',
            color: INK.primary,
          }}
        >
          <p style={{margin: '0 0 8px', fontWeight: 500}}>
            {I18n.t('This document names a different student: %{name}.', {
              name: scan.student_name_on_doc ?? '',
            })}
          </p>
          <label style={{display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44}}>
            <input
              type="checkbox"
              checked={!!scan.acknowledged_mismatch}
              disabled={off}
              onChange={event => edit({acknowledged_mismatch: event.target.checked})}
            />
            {I18n.t('This is the right student')}
          </label>
        </div>
      )}
      {previewing && scan.name_found === false && (
        <p style={{...muted, margin: '0 0 12px'}}>
          {I18n.t("No student name was found in the document, so it couldn't be checked.")}
        </p>
      )}
      <Label text={I18n.t('Plan type')}>
        <select
          style={field}
          value={scan.plan_type ?? ''}
          disabled={off}
          onChange={event => edit({plan: {plan_type: event.target.value}})}
        >
          {!scan.plan_type && <option value="">{I18n.t('Choose…')}</option>}
          {PLAN_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {I18n.t(type.label)}
            </option>
          ))}
        </select>
      </Label>
      <Label text={I18n.t('Start date')}>
        <input
          style={field}
          type="date"
          value={scan.start_date ?? ''}
          disabled={off}
          onChange={event => edit({plan: {start_date: event.target.value}})}
        />
      </Label>
      <Label text={I18n.t('End date')}>
        <input
          style={field}
          type="date"
          value={scan.end_date ?? ''}
          disabled={off}
          onChange={event => edit({plan: {end_date: event.target.value}})}
        />
      </Label>
    </Card>
  )

  return (
    <div style={{display: 'grid', gap: 'clamp(12px, 3vw, 16px)'}}>
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          style={{margin: 0, fontWeight: 500, fontSize: '1.125rem', color: INK.primary}}
        >
          {I18n.t('Scan for %{name}', {name: nameOf(showing)})}
        </h3>
        {showing.filename && <p style={{...muted, margin: '2px 0 0'}}>{showing.filename}</p>}
      </div>
      {hasQueue && narrow && stepper}

      <div
        data-testid="review-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(16rem, 20rem) minmax(0, 1fr)',
          gap: 'clamp(12px, 3vw, 16px)',
          alignItems: 'start',
        }}
      >
        <div style={{display: 'grid', gap: 'clamp(12px, 3vw, 16px)', minWidth: 0}}>
          {hasQueue && !narrow && queue}
          {summary}
        </div>
        <div style={{display: 'grid', gap: 'clamp(12px, 3vw, 16px)', minWidth: 0}}>
          <section
            aria-label={I18n.t('Accommodations found')}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 18rem), 1fr))',
              gap: 12,
              alignItems: 'start',
            }}
          >
            {showing.rows.length === 0 && (
              <p style={{...muted, margin: 0}}>
                {I18n.t('No accommodations in your catalog were found in this document.')}
              </p>
            )}
            {showing.rows.map(row => (
              <ScanCard
                key={`${showing.id}-${row.index}`}
                item={row}
                disabled={off}
                onChange={change => edit({items: [{index: row.index, ...change}]})}
              />
            ))}
          </section>

          {unmapped.length > 0 && (
            <Card id="scan-unmapped" title={I18n.t('Not mapped')}>
              <p style={{...muted, margin: '0 0 8px'}}>
                {I18n.t(
                  "These didn't match anything in your catalog. Keep one as a note on the plan, or leave it out.",
                )}
              </p>
              <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
                {unmapped.map((note, index) => (
                  <li key={`${index}-${note.text}`}>
                    <label style={{display: 'flex', alignItems: 'center', gap: 8, minHeight: 44}}>
                      <input
                        type="checkbox"
                        checked={kept.includes(index)}
                        disabled={off}
                        onChange={event => toggleKept(index, event.target.checked)}
                      />
                      <span>
                        {I18n.t('Keep as a note on the plan: %{text}', {text: note.text})}
                        {note.page !== null && ` (${I18n.t('page %{page}', {page: note.page})})`}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 1,
          background: PAPER,
          boxShadow: '0 -2px 4px rgba(0,0,0,0.2)',
          padding: '8px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {previewing ? (
          <>
            <button
              type="button"
              style={{...button, opacity: blocker || busy ? 0.5 : 1}}
              disabled={busy || !!blocker}
              onClick={apply}
            >
              {single ? I18n.t('Apply') : I18n.t('Apply & next')}
            </button>
            <button type="button" style={flatButton} disabled={busy} onClick={skip}>
              {single ? I18n.t('Discard') : I18n.t('Skip')}
            </button>
          </>
        ) : (
          showing.workflow_state === 'applied' && (
            <button type="button" style={flatButton} disabled={busy} onClick={undo}>
              {I18n.t('Undo')}
            </button>
          )
        )}
        {!(single && previewing) && (
          <button type="button" style={flatButton} disabled={busy} onClick={back}>
            {single ? I18n.t('Scan another') : I18n.t('Back to matches')}
          </button>
        )}
        {previewing && blocker && <span style={muted}>{blocker}</span>}
      </div>
      <Status message={message} />
    </div>
  )
}
