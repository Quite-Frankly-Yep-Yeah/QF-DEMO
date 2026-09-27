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
import {ELEVATION, INK, ROBOTO} from '../../self_paced_home/react/material'
import type {FoundStudent, LinkRequest, StudentSearch} from './types'

const I18n = createI18nScope('self_paced_observer')

const SEARCH_DELAY_MS = 350
const NOTE_LIMIT = 300
// The smallest thing a thumb can hit reliably.
const TAP = 44
const BRAND = '#1565C0'

// Mirrors SelfPaced::StudentFinder.parts: the server won't search on less than
// two parts of a name, so there is no point asking it.
export function nameParts(query: string): string[] {
  return query.toLowerCase().match(/[\p{L}'’-]+/gu) ?? []
}

export function specificEnough(query: string): boolean {
  const parts = nameParts(query)
  return parts.length >= 2 && parts.length <= 4 && parts.every(part => part.length >= 2)
}

// The school's message when it won't do something, from a failed request.
async function messageFrom(error: unknown): Promise<string> {
  const response = (error as {response?: Response} | null)?.response
  try {
    const json = await response?.json()
    if (typeof json?.message === 'string') return json.message
  } catch {
    // fall through to the general message
  }
  return I18n.t("That didn't work. Please try again.")
}

const STATUS: Record<'pending' | 'approved' | 'declined', {label: () => string; color: string}> = {
  pending: {label: () => I18n.t('Waiting for the school'), color: '#EF6C00'},
  approved: {label: () => I18n.t('Approved'), color: '#2E7D32'},
  declined: {label: () => I18n.t('Not approved'), color: '#C62828'},
}

const button: React.CSSProperties = {
  minHeight: TAP,
  padding: '0 20px',
  border: 'none',
  borderRadius: 2,
  background: BRAND,
  color: '#fff',
  font: 'inherit',
  fontWeight: 500,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: ELEVATION[2],
}

const textButton: React.CSSProperties = {
  minHeight: TAP,
  padding: '0 12px',
  border: 'none',
  background: 'transparent',
  color: BRAND,
  font: 'inherit',
  fontWeight: 500,
  cursor: 'pointer',
}

const field: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 48,
  padding: '12px 14px',
  margin: '4px 0 8px',
  border: '1px solid #9E9E9E',
  borderRadius: 2,
  font: 'inherit',
  fontSize: '1rem',
}

// What a parent has asked the school so far, and its answer.
export function RequestList({
  requests,
  busyId,
  onCancel,
}: {
  requests: LinkRequest[]
  busyId: string | null
  onCancel: (request: LinkRequest) => void
}) {
  if (requests.length === 0) return null
  return (
    <ul
      aria-label={I18n.t('Your requests')}
      style={{listStyle: 'none', margin: '0 0 24px', padding: 0}}
    >
      {requests.map(request => {
        const status = STATUS[request.status as keyof typeof STATUS]
        if (!status) return null
        return (
          <li key={request.id} style={{padding: '12px 0', borderTop: '1px solid rgba(0,0,0,0.08)'}}>
            <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px'}}>
              <strong style={{overflowWrap: 'anywhere'}}>{request.student.name}</strong>
              <span
                style={{
                  padding: '2px 10px',
                  borderRadius: 12,
                  background: status.color,
                  color: '#fff',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                }}
              >
                {status.label()}
              </span>
              <span style={{color: INK.secondary, fontSize: '0.875rem'}}>
                {I18n.t('Asked %{date}', {
                  date: new Date(request.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  }),
                })}
              </span>
            </div>
            {request.status === 'approved' && (
              <p style={{margin: '4px 0 0', color: INK.secondary}}>
                {I18n.t('The school linked you. Reload this page to see how %{student} is doing.', {
                  student: request.student.name,
                })}
              </p>
            )}
            {request.status === 'declined' && (
              <p style={{margin: '4px 0 0', color: INK.secondary}}>
                {request.response ??
                  I18n.t(
                    "The school didn't approve this request. Ask them if you're not sure why.",
                  )}
              </p>
            )}
            {request.status === 'pending' && (
              <button
                type="button"
                style={textButton}
                disabled={busyId === request.id}
                onClick={() => onCancel(request)}
                aria-label={I18n.t('Cancel the request for %{student}', {
                  student: request.student.name,
                })}
              >
                {I18n.t('Cancel request')}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// A parent's way to a student: type their name, pick them from the few that
// match, and ask the school to link them. Nothing is linked from here; the
// school decides.
export default function FindStudent({
  searchUrl,
  requestsUrl,
  requests,
  onRequested,
  onCancelled,
}: {
  searchUrl: string
  requestsUrl: string
  requests: LinkRequest[]
  onRequested: (request: LinkRequest) => void
  onCancelled: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<StudentSearch | null>(null)
  const [searching, setSearching] = useState(false)
  const [chosen, setChosen] = useState<FoundStudent | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')

  // Search a moment after the parent stops typing, and only once what they've
  // typed is specific enough for the school to answer.
  useEffect(() => {
    setChosen(null)
    setResult(null)
    if (!specificEnough(query)) {
      setSearching(false)
      return undefined
    }
    let current = true
    setSearching(true)
    const timer = window.setTimeout(() => {
      doFetchApi<StudentSearch>({path: searchUrl, params: {q: query}})
        .then(({json}) => {
          if (current) setResult(json ?? {students: [], too_many: false})
        })
        .catch(async e => {
          if (current) setError(await messageFrom(e))
        })
        .finally(() => {
          if (current) setSearching(false)
        })
    }, SEARCH_DELAY_MS)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [query, searchUrl])

  const ask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!chosen) return
    setBusy(true)
    setError('')
    setSent('')
    try {
      const {json} = await doFetchApi<LinkRequest>({
        path: requestsUrl,
        method: 'POST',
        body: {student_id: chosen.id, note},
      })
      if (json) onRequested(json)
      setSent(
        I18n.t('Sent. The school will look at your request for %{name}.', {name: chosen.name}),
      )
      setQuery('')
      setNote('')
    } catch (e) {
      setError(await messageFrom(e))
    }
    setBusy(false)
  }

  const cancel = async (request: LinkRequest) => {
    setBusyId(request.id)
    setError('')
    try {
      await doFetchApi({path: `${requestsUrl}/${request.id}`, method: 'DELETE'})
      onCancelled(request.id)
    } catch (e) {
      setError(await messageFrom(e))
    }
    setBusyId(null)
  }

  const parts = nameParts(query)
  const hint =
    parts.length === 0
      ? I18n.t("Type your student's first and last name.")
      : parts.length === 1
        ? I18n.t('Add their last name too.')
        : null

  return (
    <div style={{fontFamily: ROBOTO}}>
      <RequestList requests={requests} busyId={busyId} onCancel={cancel} />

      <form onSubmit={ask} noValidate={true}>
        <label style={{display: 'block'}}>
          {I18n.t("Your student's name")}
          <input
            type="search"
            style={field}
            value={query}
            onChange={event => {
              setQuery(event.target.value)
              setSent('')
              setError('')
            }}
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
          />
        </label>

        <div
          role="status"
          aria-live="polite"
          style={{minHeight: 24, color: INK.secondary, fontSize: '0.875rem', margin: '0 0 8px'}}
        >
          {sent && <span style={{color: '#2E7D32'}}>{sent}</span>}
          {!sent && searching && I18n.t('Looking...')}
          {!sent && !searching && !result && hint}
          {!sent &&
            !searching &&
            result?.too_many &&
            I18n.t('That matches a lot of students. Type more of the name.')}
          {!sent &&
            !searching &&
            result &&
            !result.too_many &&
            result.students.length === 0 &&
            I18n.t(
              'No student matches that name. Check the spelling. Only students in self-paced classes can be found.',
            )}
        </div>

        {result && result.students.length > 0 && (
          <fieldset style={{border: 'none', margin: '0 0 16px', padding: 0}}>
            <legend style={{padding: 0, marginBottom: 4}}>{I18n.t('Which one is yours?')}</legend>
            {result.students.map(student => (
              <label
                key={student.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 48,
                  padding: '0 12px',
                  borderRadius: 2,
                  background: chosen?.id === student.id ? 'rgba(21,101,192,0.10)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="ob-find-student"
                  checked={chosen?.id === student.id}
                  onChange={() => setChosen(student)}
                  style={{width: 20, height: 20, margin: 0}}
                />
                {student.name}
              </label>
            ))}
          </fieldset>
        )}

        {chosen && (
          <>
            <label style={{display: 'block'}}>
              {I18n.t('Anything the school should know? (optional)')}
              <textarea
                style={{...field, minHeight: 72, resize: 'vertical'}}
                value={note}
                maxLength={NOTE_LIMIT}
                onChange={event => setNote(event.target.value)}
                placeholder={I18n.t("For example: I'm %{name}'s mother.", {
                  name: chosen.name.split(' ')[0],
                })}
              />
            </label>
            <p style={{margin: '0 0 12px', color: INK.secondary, fontSize: '0.875rem'}}>
              {I18n.t(
                "The school checks that you're %{name}'s parent before you can see anything.",
                {name: chosen.name.split(' ')[0]},
              )}
            </p>
            <button type="submit" style={button} disabled={busy}>
              {busy ? I18n.t('Sending...') : I18n.t('Ask the school to link us')}
            </button>
          </>
        )}

        {error && (
          <div
            role="alert"
            style={{
              background: '#FFEBEE',
              color: '#B71C1C',
              padding: '12px 16px',
              margin: '16px 0 0',
              borderRadius: 2,
            }}
          >
            {error}
          </div>
        )}
      </form>
    </div>
  )
}
