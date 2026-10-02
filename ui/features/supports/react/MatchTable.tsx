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
import {INK} from '../../self_paced_home/react/material'
import PersonPicker from './PersonPicker'
import type {Person, ScanBatch, ScanRecord} from './types'
import {BRAND, button, field, flatButton, messageFrom, muted, Status} from './ui'

const I18n = createI18nScope('supports')

const isReading = (file: ScanRecord) =>
  file.workflow_state !== 'discarded' &&
  (file.extraction_state === 'queued' || file.extraction_state === 'running')

type RowState = 'reading' | 'failed' | 'ready' | 'confirmed' | 'applied' | 'skipped'

export function rowState(file: ScanRecord): RowState {
  if (file.workflow_state === 'discarded') return 'skipped'
  if (file.workflow_state === 'applied') return 'applied'
  if (isReading(file)) return 'reading'
  if (file.extraction_state === 'failed') return 'failed'
  return file.student ? 'confirmed' : 'ready'
}

export function countsOf(files: ScanRecord[]): ScanBatch['counts'] {
  const counts = {reading: 0, ready: 0, failed: 0, confirmed: 0, applied: 0, skipped: 0}
  files.forEach(file => {
    counts[rowState(file)] += 1
  })
  return counts
}

// The batch with one file replaced by what the server just said about it.
export function replaceFile(batch: ScanBatch, record: ScanRecord): ScanBatch {
  const files = batch.files.map(file => (file.id === record.id ? record : file))
  return {...batch, files, counts: countsOf(files)}
}

const withSis = (person: {sis_user_id?: string | null}) =>
  person.sis_user_id ? ` (${I18n.t('SIS ID')} ${person.sis_user_id})` : ''

const STATUS_LABEL = (state: RowState) => {
  switch (state) {
    case 'reading':
      return I18n.t('Reading')
    case 'failed':
      return I18n.t('Failed')
    case 'ready':
      return I18n.t('Ready')
    case 'confirmed':
      return I18n.t('Confirmed')
    case 'applied':
      return I18n.t('Applied')
    default:
      return I18n.t('Skipped')
  }
}

// Why this student is proposed, in words.
function whyText(file: ScanRecord): string {
  const match = file.match
  if (!match || rowState(file) === 'reading' || rowState(file) === 'failed') return ''
  const [first] = match.candidates
  if (match.state === 'none' || !first) return I18n.t('No match')
  if (match.candidates.length > 1) {
    return I18n.t('Name matches %{count} students', {count: match.candidates.length})
  }
  switch (first.reason) {
    case 'id':
      return I18n.t('SIS ID matches')
    case 'name':
      return I18n.t('Name matches exactly')
    default:
      return I18n.t('Name partly matches')
  }
}

const cell: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  verticalAlign: 'top',
  borderBottom: '1px solid #E0E0E0',
}

const smallButton: React.CSSProperties = {...flatButton, padding: '0 8px', fontSize: '0.875rem'}

// Stage 1 of a batch: one row per file, each with the student proposed for it.
// A person confirms the matches; nothing is attached to a student until then.
export default function MatchTable({
  batch,
  accountId,
  pollMs = 2000,
  onChange,
  onReview,
}: {
  batch: ScanBatch
  accountId: string
  pollMs?: number
  onChange: (batch: ScanBatch) => void
  onReview: () => void
}) {
  const [choices, setChoices] = useState<Record<number, string>>({})
  const [found, setFound] = useState<Record<number, Person>>({})
  const [editing, setEditing] = useState<number[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const changes = useRef(0)
  const latest = useRef(batch)
  latest.current = batch

  const files = batch.files
  const batchId = batch.id
  const counts = countsOf(files)
  const total = files.length - counts.skipped
  const reading = counts.reading

  // While any file is being read, ask again. A failed poll changes nothing and
  // the next round tries again.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const polling = reading > 0
  useEffect(() => {
    if (!polling) return undefined
    let cancelled = false
    let timer = 0
    const schedule = () => {
      timer = window.setTimeout(async () => {
        const seen = changes.current
        try {
          const {json} = await doFetchApi<ScanBatch>({
            path: `/api/v1/supports/scan_batches/${batchId}?account_id=${accountId}`,
          })
          // an answer older than something this person just did is dropped
          if (json && !cancelled && !busyRef.current && seen === changes.current) {
            onChangeRef.current(json)
          }
        } catch {
          // keep the table as it is
        }
        if (!cancelled) schedule()
      }, pollMs)
    }
    schedule()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [polling, batchId, accountId, pollMs])

  const choiceFor = (file: ScanRecord): string => {
    if (file.id in choices) return choices[file.id]
    if (file.student) return file.student.id
    return file.match?.state === 'confident' ? (file.match.candidates[0]?.id ?? '') : ''
  }

  const importPath = (file: ScanRecord, suffix = '') =>
    `/api/v1/supports/imports/${file.id}${suffix}?account_id=${accountId}`

  // One change at a time: every control is off while a request is out.
  const run = async (work: () => Promise<void>) => {
    busyRef.current = true
    changes.current += 1
    setBusy(true)
    setNote('')
    try {
      await work()
    } catch (error) {
      setNote(await messageFrom(error))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const replace = (record: ScanRecord) => onChange(replaceFile(latest.current, record))

  const confirmOne = async (file: ScanRecord, studentId: string) => {
    const {json} = await doFetchApi<ScanRecord>({
      path: importPath(file, '/student'),
      method: 'PUT',
      body: {student_id: studentId},
    })
    if (json) {
      replace(json)
      setEditing(list => list.filter(id => id !== file.id))
      setChoices(({[file.id]: _gone, ...rest}) => rest)
    }
  }

  const exact = files.filter(
    file => rowState(file) === 'ready' && file.match?.state === 'confident' && choiceFor(file),
  )

  const confirmExact = () =>
    run(async () => {
      let done = 0
      let failed = 0
      for (const file of exact) {
        try {
          await confirmOne(file, choiceFor(file))
          done += 1
        } catch {
          failed += 1
        }
      }
      const said =
        done === 1
          ? I18n.t('Confirmed 1 exact match.')
          : I18n.t('Confirmed %{count} exact matches.', {count: done})
      setNote(
        failed > 0
          ? `${said} ${I18n.t("%{count} couldn't be confirmed. Confirm those one at a time.", {count: failed})}`
          : said,
      )
    })

  const skip = (file: ScanRecord) =>
    run(async () => {
      const {json} = await doFetchApi<ScanRecord>({path: importPath(file), method: 'DELETE'})
      replace({...(json ?? file), workflow_state: 'discarded'})
      setNote(I18n.t('Skipped %{name}.', {name: file.filename ?? ''}))
    })

  const retry = (file: ScanRecord) =>
    run(async () => {
      const {json} = await doFetchApi<ScanRecord>({
        path: importPath(file, '/retry'),
        method: 'POST',
      })
      if (json) replace(json)
    })

  const progress = (() => {
    if (total === 0) return ''
    if (reading > 0) return I18n.t('%{read} of %{total} read', {read: total - reading, total})
    const said =
      total === 1 ? I18n.t('The file was read.') : I18n.t('All %{total} files read.', {total})
    return counts.failed > 0
      ? `${said} ${I18n.t('%{count} could not be read.', {count: counts.failed})}`
      : said
  })()

  const reviewable = files.filter(
    file => file.student && file.workflow_state !== 'discarded',
  ).length

  return (
    <div>
      <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12}}>
        <button
          type="button"
          style={{...button, opacity: exact.length === 0 || busy ? 0.5 : 1}}
          disabled={exact.length === 0 || busy}
          onClick={confirmExact}
        >
          {I18n.t('Confirm all exact matches')}
        </button>
        <button
          type="button"
          style={{...button, opacity: reviewable === 0 || busy ? 0.5 : 1}}
          disabled={reviewable === 0 || busy}
          onClick={onReview}
        >
          {reviewable === 1
            ? I18n.t('Review 1 scan')
            : I18n.t('Review %{count} scans', {count: reviewable})}
        </button>
      </div>
      <Status message={[progress, note].filter(Boolean).join(' ')} />

      <div
        role="region"
        aria-label={I18n.t('Matches')}
        // the table scrolls sideways on a phone instead of squeezing
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        style={{overflowX: 'auto', marginTop: 12}}
      >
        <table style={{borderCollapse: 'collapse', width: '100%', minWidth: '56rem'}}>
          <thead>
            <tr>
              {[
                I18n.t('File'),
                I18n.t('Status'),
                I18n.t('Name on the IEP'),
                I18n.t('Student'),
                I18n.t('Why'),
                I18n.t('Actions'),
              ].map(heading => (
                <th
                  key={heading}
                  scope="col"
                  style={{...cell, color: INK.secondary, fontWeight: 500, fontSize: '0.875rem'}}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {files.map(file => {
              const state = rowState(file)
              const name = file.filename ?? I18n.t('Untitled')
              const open = state === 'ready' || (state === 'confirmed' && editing.includes(file.id))
              const candidates = file.match?.candidates ?? []
              const options: {id: string; label: string}[] = candidates.map(c => ({
                id: c.id,
                label: `${c.name}${withSis(c)}`,
              }))
              const extra = found[file.id] ?? file.student
              if (extra && !options.some(o => o.id === extra.id)) {
                options.push({id: extra.id, label: `${extra.name}${withSis(extra)}`})
              }
              const value = choiceFor(file)
              const idOnDoc = file.match?.student_id_on_doc
              return (
                <tr key={file.id}>
                  <th scope="row" style={{...cell, fontWeight: 500, color: INK.primary}}>
                    {name}
                  </th>
                  <td style={cell}>
                    <span
                      style={{
                        fontWeight: 500,
                        color: state === 'failed' ? '#B71C1C' : INK.primary,
                      }}
                    >
                      {STATUS_LABEL(state)}
                    </span>
                    {state === 'failed' && (
                      <div style={muted}>
                        {file.extraction_error ?? I18n.t("The document couldn't be read.")}
                      </div>
                    )}
                  </td>
                  <td style={cell}>
                    {file.scan?.student_name_on_doc ?? '—'}
                    {idOnDoc && (
                      <div style={muted}>{I18n.t('ID on the IEP: %{id}', {id: idOnDoc})}</div>
                    )}
                  </td>
                  <td style={{...cell, minWidth: '16rem'}}>
                    {open ? (
                      <>
                        <label style={{display: 'block'}}>
                          <span style={{position: 'absolute', left: -10000}}>
                            {I18n.t('Student for %{name}', {name})}
                          </span>
                          <select
                            style={{...field, margin: '0 0 8px'}}
                            value={value}
                            disabled={busy}
                            onChange={event =>
                              setChoices(prev => ({...prev, [file.id]: event.target.value}))
                            }
                          >
                            <option value="">{I18n.t('Choose a student')}</option>
                            {options.map(option => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <PersonPicker
                          label={I18n.t('Search for a student for %{name}', {name})}
                          url="/api/v1/supports/students"
                          resultKey="students"
                          selected={null}
                          onSelect={person => {
                            if (!person) return
                            setFound(prev => ({...prev, [file.id]: person}))
                            setChoices(prev => ({...prev, [file.id]: person.id}))
                          }}
                        />
                      </>
                    ) : state === 'confirmed' || state === 'applied' ? (
                      <span>
                        {file.student?.name}
                        {file.student && withSis(file.student as Person)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={cell}>{whyText(file)}</td>
                  <td style={cell}>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: 4}}>
                      {open && (
                        <button
                          type="button"
                          style={{
                            ...smallButton,
                            color: '#fff',
                            background: BRAND,
                            opacity: !value || busy ? 0.5 : 1,
                          }}
                          aria-label={I18n.t('Confirm %{name}', {name})}
                          disabled={!value || busy}
                          onClick={() => run(() => confirmOne(file, value))}
                        >
                          {I18n.t('Confirm')}
                        </button>
                      )}
                      {state === 'confirmed' && !open && (
                        <button
                          type="button"
                          style={smallButton}
                          aria-label={I18n.t('Change student for %{name}', {name})}
                          disabled={busy}
                          onClick={() => setEditing(list => [...list, file.id])}
                        >
                          {I18n.t('Change')}
                        </button>
                      )}
                      {state === 'failed' && (
                        <button
                          type="button"
                          style={smallButton}
                          aria-label={I18n.t('Try again %{name}', {name})}
                          disabled={busy}
                          onClick={() => retry(file)}
                        >
                          {I18n.t('Try again')}
                        </button>
                      )}
                      {state !== 'applied' && state !== 'skipped' && (
                        <button
                          type="button"
                          style={smallButton}
                          aria-label={I18n.t('Skip %{name}', {name})}
                          disabled={busy}
                          onClick={() => skip(file)}
                        >
                          {I18n.t('Skip')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
