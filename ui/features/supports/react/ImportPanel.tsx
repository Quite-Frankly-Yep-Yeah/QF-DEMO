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

import React, {useCallback, useEffect, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import type {ImportAction, ImportRecord} from './types'
import {button, Card, field, flatButton, formatDate, Label, messageFrom, muted, Status} from './ui'
import {DANGER, DIVIDER} from '@canvas/material'

const I18n = createI18nScope('supports')

const COLUMNS =
  'student_sis_id (or student_login), plan_type, plan_id, start_date, end_date, case_manager_sis_id, accommodation, parameters, courses, teacher_note'

const actionLabel = (action: ImportAction) => {
  switch (action) {
    case 'create_plan':
      return I18n.t('New plan')
    case 'update_plan':
      return I18n.t('Plan changed')
    case 'add':
      return I18n.t('Added')
    case 'update':
      return I18n.t('Changed')
    case 'unchanged':
      return I18n.t('No change')
    default:
      return I18n.t('Problem')
  }
}

function Preview({record}: {record: ImportRecord}) {
  const summary = record.summary
  const problems = record.rows.filter(row => row.action === 'error')
  return (
    <div>
      <p style={{margin: '0 0 8px'}}>
        {I18n.t(
          '%{created} new plans, %{added} accommodations added, %{changed} changed, %{unchanged} unchanged, %{errors} problems.',
          {
            created: summary.create_plan ?? 0,
            added: summary.add ?? 0,
            changed: (summary.update ?? 0) + (summary.update_plan ?? 0),
            unchanged: summary.unchanged ?? 0,
            errors: summary.error ?? 0,
          },
        )}
      </p>
      {problems.length > 0 && (
        <p style={{margin: '0 0 8px'}}>
          {I18n.t('Rows with problems are skipped when you apply the file.')}
        </p>
      )}
      <div style={{overflowX: 'auto'}}>
        <table style={{borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem'}}>
          <caption style={{textAlign: 'left', ...muted}}>{I18n.t('What each row does')}</caption>
          <thead>
            <tr>
              {[I18n.t('Line'), I18n.t('Student'), I18n.t('Accommodation'), I18n.t('Result')].map(
                heading => (
                  <th
                    key={heading}
                    scope="col"
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderBottom: '1px solid #BDBDBD',
                    }}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {record.rows.map(row => (
              <tr key={row.line}>
                <td style={{padding: '6px 8px'}}>{row.line}</td>
                <td style={{padding: '6px 8px'}}>{row.student ?? ''}</td>
                <td style={{padding: '6px 8px'}}>{row.accommodation ?? ''}</td>
                <td
                  style={{
                    padding: '6px 8px',
                    color: row.action === 'error' ? DANGER : undefined,
                  }}
                >
                  {actionLabel(row.action)}
                  {row.message ? `: ${row.message}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Plans and accommodations from the district's system as CSV: preview what a
// file would do, apply it, and undo it if it was wrong.
export default function ImportPanel({accounts}: {accounts: {id: string; name: string}[]}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportRecord | null>(null)
  const [history, setHistory] = useState<ImportRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const loadHistory = useCallback(() => {
    doFetchApi<{imports: ImportRecord[]}>({
      path: '/api/v1/supports/imports',
      params: {account_id: accountId},
    })
      .then(({json}) => setHistory(json?.imports ?? []))
      .catch(() => setHistory([]))
  }, [accountId])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const act = async (
    request: () => Promise<{json?: ImportRecord}>,
    done: (record: ImportRecord) => string,
  ) => {
    setBusy(true)
    setMessage('')
    try {
      const {json} = await request()
      if (json) {
        setPreview(json.workflow_state === 'previewed' ? json : null)
        setMessage(done(json))
      }
      loadHistory()
    } catch (error) {
      setMessage(await messageFrom(error))
    } finally {
      setBusy(false)
    }
  }

  const upload = () => {
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    body.append('account_id', accountId)
    act(
      () => doFetchApi<ImportRecord>({path: '/api/v1/supports/imports', method: 'POST', body}),
      () => I18n.t('Here is what the file would do. Nothing has changed yet.'),
    )
  }

  const path = (id: number, suffix = '') =>
    `/api/v1/supports/imports/${id}${suffix}?account_id=${accountId}`

  return (
    <div style={{display: 'grid', gap: 'clamp(12px, 3vw, 20px)'}}>
      <Card id="supports-import" title={I18n.t('Import plans')}>
        <p style={{...muted, margin: '0 0 12px'}}>
          {I18n.t(
            'One row per accommodation. Nothing is removed: accommodations missing from the file stay as they are. Columns: %{columns}.',
            {columns: COLUMNS},
          )}
        </p>
        {accounts.length > 1 && (
          <Label text={I18n.t('Import into')}>
            <select
              style={field}
              value={accountId}
              onChange={event => setAccountId(event.target.value)}
            >
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Label>
        )}
        <Label text={I18n.t('CSV file')}>
          <input
            style={field}
            type="file"
            accept=".csv,text/csv"
            onChange={event => setFile(event.target.files?.[0] ?? null)}
          />
        </Label>
        <button type="button" style={button} disabled={!file || busy} onClick={upload}>
          {I18n.t('Preview')}
        </button>
        {preview && (
          <div style={{marginTop: 16}}>
            <Preview record={preview} />
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12}}>
              <button
                type="button"
                style={button}
                disabled={busy}
                onClick={() =>
                  act(
                    () =>
                      doFetchApi<ImportRecord>({path: path(preview.id, '/apply'), method: 'POST'}),
                    () => I18n.t('Applied. You can undo it below.'),
                  )
                }
              >
                {I18n.t('Apply')}
              </button>
              <button
                type="button"
                style={flatButton}
                disabled={busy}
                onClick={() =>
                  act(
                    () => doFetchApi<ImportRecord>({path: path(preview.id), method: 'DELETE'}),
                    () => I18n.t('Preview discarded.'),
                  )
                }
              >
                {I18n.t('Discard')}
              </button>
            </div>
          </div>
        )}
        <Status message={message} />
      </Card>

      {history.length > 0 && (
        <Card id="supports-import-history" title={I18n.t('Recent imports')}>
          <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
            {history.map(record => (
              <li
                key={record.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 0',
                  borderTop: `1px solid ${DIVIDER}`,
                }}
              >
                <span>
                  {I18n.t('%{file}, %{date}: %{state}', {
                    file: record.filename ?? I18n.t('Upload'),
                    date: formatDate(record.created_at),
                    state:
                      record.workflow_state === 'applied'
                        ? I18n.t('applied')
                        : record.workflow_state === 'undone'
                          ? I18n.t('undone')
                          : record.workflow_state === 'discarded'
                            ? I18n.t('discarded')
                            : I18n.t('previewed'),
                  })}
                </span>
                {record.workflow_state === 'applied' && (
                  <button
                    type="button"
                    style={flatButton}
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          doFetchApi<ImportRecord>({
                            path: path(record.id, '/undo'),
                            method: 'POST',
                          }),
                        () => I18n.t('Undone. Plans and accommodations are back to how they were.'),
                      )
                    }
                  >
                    {I18n.t('Undo')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
