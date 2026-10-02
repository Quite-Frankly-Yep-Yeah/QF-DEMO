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
import BatchUpload from './BatchUpload'
import MatchTable, {replaceFile} from './MatchTable'
import PersonPicker from './PersonPicker'
import ReviewWorkspace from './ReviewWorkspace'
import type {Person, ScanBatch, ScanRecord} from './types'
import {BRAND, button, Card, field, flatButton, Label, messageFrom, muted, Status} from './ui'

const I18n = createI18nScope('supports')

const MAX_BYTES = 20 * 1024 * 1024

// Reads an IEP (PDF or image) for one student and proposes the accommodations
// in it. The person checks the proposal before anything is saved
// (docs/superpowers/specs/2026-10-01-iep-scan-design.md). Pass +student+ to
// scan for a student already chosen.
export default function ScanPanel({
  accountId,
  student: fixedStudent = null,
  pollMs = 2000,
}: {
  accountId: string
  student?: Person | null
  pollMs?: number
}) {
  const [picked, setPicked] = useState<Person | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [record, setRecord] = useState<ScanRecord | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'one' | 'several'>('one')
  const [batch, setBatch] = useState<ScanBatch | null>(null)
  // the batch's review page: which scan is open, and what to tell the table
  const [reviewing, setReviewing] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const student = fixedStudent ?? picked

  const path = (suffix = '') =>
    `/api/v1/supports/imports/${record?.id}${suffix}?account_id=${accountId}`

  // While the document is being read, ask again until it is done.
  useEffect(() => {
    if (!record || record.workflow_state !== 'previewed') return undefined
    if (record.extraction_state !== 'queued' && record.extraction_state !== 'running') {
      return undefined
    }
    const timer = window.setTimeout(async () => {
      try {
        const {json} = await doFetchApi<ScanRecord>({path: path()})
        if (json) setRecord(json)
      } catch (error) {
        setMessage(await messageFrom(error))
      }
    }, pollMs)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, pollMs])

  const act = async (
    request: () => Promise<{json?: ScanRecord}>,
    done?: (next: ScanRecord) => string,
  ): Promise<boolean> => {
    setBusy(true)
    setMessage('')
    try {
      const {json} = await request()
      if (json) {
        setRecord(json)
        if (done) setMessage(done(json))
      }
      return true
    } catch (error) {
      setMessage(await messageFrom(error))
      return false
    } finally {
      setBusy(false)
    }
  }

  const upload = () => {
    if (!student || !file) return
    if (file.size > MAX_BYTES) {
      setMessage(I18n.t('The file is larger than 20 MB.'))
      return
    }
    const body = new FormData()
    body.append('file', file)
    body.append('account_id', accountId)
    body.append('student_id', student.id)
    act(() => doFetchApi<ScanRecord>({path: '/api/v1/supports/imports', method: 'POST', body}))
  }

  const reset = () => {
    setRecord(null)
    setFile(null)
    setMessage('')
  }

  const progress =
    record?.workflow_state === 'previewed' &&
    (record.extraction_state === 'queued' || record.extraction_state === 'running')
      ? I18n.t('Reading the document. This can take a minute.')
      : ''

  return (
    <Card id="supports-scan" title={I18n.t('Scan an IEP')}>
      {!record && !batch && !fixedStudent && (
        <div
          role="group"
          aria-label={I18n.t('How many IEPs')}
          style={{display: 'flex', gap: 8, margin: '0 0 12px'}}
        >
          {(['one', 'several'] as const).map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              style={
                mode === value
                  ? {...button, boxShadow: 'none'}
                  : {...flatButton, border: `1px solid ${BRAND}`}
              }
              onClick={() => setMode(value)}
            >
              {value === 'one' ? I18n.t('One IEP') : I18n.t('Several IEPs')}
            </button>
          ))}
        </div>
      )}

      {!record && !batch && mode === 'several' && !fixedStudent && (
        <BatchUpload accountId={accountId} onStarted={setBatch} />
      )}

      {batch && reviewing === null && (
        <>
          <MatchTable
            batch={batch}
            accountId={accountId}
            pollMs={pollMs}
            notice={notice}
            onChange={setBatch}
            onReview={() => {
              const queue = batch.files.filter(f => f.student)
              const first = queue.find(f => f.workflow_state === 'previewed') ?? queue[0]
              if (!first) return
              setNotice('')
              setReviewing(first.id)
            }}
          />
          <p style={{margin: '12px 0 0'}}>
            <button type="button" style={flatButton} onClick={() => setBatch(null)}>
              {I18n.t('Start a new batch')}
            </button>
          </p>
        </>
      )}

      {batch && reviewing !== null && (
        <ReviewWorkspace
          // the same page for the whole batch, so focus can move to the next heading
          records={batch.files.filter(f => f.student)}
          currentId={reviewing}
          accountId={accountId}
          single={false}
          onSelect={setReviewing}
          onChange={next => setBatch(current => (current ? replaceFile(current, next) : current))}
          onBack={message => {
            setNotice(message ?? '')
            setReviewing(null)
          }}
        />
      )}

      {!record && !batch && (mode === 'one' || fixedStudent) && (
        <>
          <p style={{...muted, margin: '0 0 12px'}}>
            {I18n.t(
              'Upload an IEP as a PDF or image. The accommodations found in it are shown for you to check. Nothing is saved until you apply them.',
            )}
          </p>
          {fixedStudent ? (
            <p style={{margin: '0 0 12px'}}>
              <span style={{fontWeight: 500}}>{I18n.t('Student')}: </span>
              {fixedStudent.name}
            </p>
          ) : (
            <PersonPicker
              label={I18n.t('Student')}
              url="/api/v1/supports/students"
              resultKey="students"
              selected={picked}
              onSelect={setPicked}
            />
          )}
          <Label text={I18n.t('IEP file')}>
            <input
              style={field}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={event => setFile(event.target.files?.[0] ?? null)}
            />
          </Label>
          <button
            type="button"
            style={{...button, opacity: !student || !file || busy ? 0.5 : 1}}
            disabled={!student || !file || busy}
            onClick={upload}
          >
            {I18n.t('Scan')}
          </button>
        </>
      )}

      {record?.extraction_state === 'failed' && record.workflow_state === 'previewed' && (
        <div>
          <p style={{margin: '0 0 12px', color: '#B71C1C'}}>
            {record.extraction_error ?? I18n.t("The document couldn't be read.")}
          </p>
          <button
            type="button"
            style={button}
            disabled={busy}
            onClick={() =>
              act(() => doFetchApi<ScanRecord>({path: path('/retry'), method: 'POST'}))
            }
          >
            {I18n.t('Try again')}
          </button>{' '}
          <button
            type="button"
            style={flatButton}
            disabled={busy}
            onClick={async () => {
              if (await act(() => doFetchApi<ScanRecord>({path: path(), method: 'DELETE'}))) {
                reset()
                setMessage(I18n.t('Discarded.'))
              }
            }}
          >
            {I18n.t('Discard')}
          </button>
        </div>
      )}

      {!batch && record && record.extraction_state === 'ready' && (
        <ReviewWorkspace
          records={[record]}
          currentId={record.id}
          accountId={accountId}
          single
          onSelect={() => {}}
          onChange={next => {
            if (next.workflow_state === 'discarded') {
              reset()
              setMessage(I18n.t('Discarded.'))
            } else {
              setRecord(next)
            }
          }}
          onBack={reset}
        />
      )}

      {/* the match table keeps its own status region */}
      {!batch && mode === 'one' && record?.extraction_state !== 'ready' && (
        <Status message={message || progress} />
      )}
    </Card>
  )
}
