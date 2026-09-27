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
import {
  APP_BAR,
  ELEVATION,
  INK,
  ink,
  PALETTE,
  ROBOTO,
  SURFACE,
} from '../../self_paced_home/react/material'
import {flyerHtml, printHtml} from './flyer'
import type {AdminRequest, Flyer, ParentsConfig} from './types'

const I18n = createI18nScope('self_paced_parents')

const GUTTER = 'clamp(8px, calc((100vw - 30rem) / 8), 32px)'
const PAD = 'clamp(16px, 5vw, 32px)'
const TAP = 44
const BRAND = '#1565C0'
const CONTACT_KEY = 'self_paced_parents_flyer_contact'
const CONTACT_LIMIT = 140

const readContact = (): string => {
  try {
    return window.localStorage.getItem(CONTACT_KEY) ?? ''
  } catch {
    return ''
  }
}

const saveContact = (value: string) => {
  try {
    window.localStorage.setItem(CONTACT_KEY, value)
  } catch {
    // private windows and blocked storage just forget it
  }
}

// What the server said when it refused, or a general message.
async function messageFrom(error: unknown): Promise<string> {
  const response = (error as {response?: Response} | null)?.response
  try {
    const json = await response?.json()
    if (typeof json?.message === 'string') return json.message
  } catch {
    // fall through
  }
  return I18n.t("That didn't work. Please try again.")
}

const flyerText = () => ({
  documentTitle: I18n.t('Parent sign-up flyer'),
  title: I18n.t("Follow your student's progress"),
  lead: I18n.t(
    'See how your student is doing in their self-paced classes: progress, pace, grades and time spent.',
  ),
  scan: I18n.t("Scan this code with your phone's camera"),
  howItWorks: I18n.t('How it works'),
  steps: [
    I18n.t('Open the link the code takes you to.'),
    I18n.t('Make your account with your name, email and a password.'),
    I18n.t("Type your student's name and ask the school to link you."),
    I18n.t("Once the school approves, you'll see their progress, grades and time in class."),
  ],
  orOpen: I18n.t("Can't scan? Open this address:"),
})

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

const flatButton: React.CSSProperties = {
  ...button,
  background: 'transparent',
  color: BRAND,
  boxShadow: 'none',
}

const field: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 48,
  padding: '12px 14px',
  margin: '4px 0 12px',
  border: '1px solid #9E9E9E',
  borderRadius: 2,
  font: 'inherit',
  fontSize: '1rem',
}

function Card({id, title, children}: {id: string; title: string; children: React.ReactNode}) {
  return (
    <section
      aria-labelledby={id}
      style={{
        background: '#FFFFFF',
        borderRadius: 2,
        boxShadow: ELEVATION[4],
        padding: `clamp(16px, 4vw, 24px) clamp(16px, 4.5vw, 24px)`,
        fontFamily: ROBOTO,
      }}
    >
      <h2
        id={id}
        style={{
          margin: '0 0 12px',
          fontFamily: ROBOTO,
          fontWeight: 300,
          fontSize: 'clamp(1.25rem, 5vw, 1.5rem)',
          color: INK.primary,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

type Mode = {id: string; kind: 'approve' | 'decline'} | null

function RequestRow({
  request,
  mode,
  busy,
  reason,
  onMode,
  onReason,
  onAnswer,
}: {
  request: AdminRequest
  mode: Mode
  busy: boolean
  reason: string
  onMode: (mode: Mode) => void
  onAnswer: (kind: 'approve' | 'decline') => void
  onReason: (value: string) => void
}) {
  const mine = mode?.id === request.id ? mode.kind : null
  const {observer, student} = request
  return (
    <li style={{padding: '14px 0', borderTop: '1px solid rgba(0,0,0,0.08)'}}>
      <div style={{overflowWrap: 'anywhere'}}>
        <strong>{observer.name}</strong>
        {observer.email && <span style={{color: INK.secondary}}> · {observer.email}</span>}
      </div>
      <div style={{margin: '2px 0', overflowWrap: 'anywhere'}}>
        {I18n.t('wants to follow')} <strong>{student.name}</strong>
      </div>
      {student.classes.length > 0 && (
        <div style={{color: INK.secondary, fontSize: '0.875rem'}}>{student.classes.join(', ')}</div>
      )}
      {student.parents > 0 && (
        <div style={{color: '#EF6C00', fontSize: '0.875rem', margin: '4px 0 0'}}>
          {I18n.t(
            {
              one: '%{name} already has 1 parent linked.',
              other: '%{name} already has %{count} parents linked.',
            },
            {count: student.parents, name: student.name},
          )}
        </div>
      )}
      {request.note && (
        <blockquote
          style={{
            margin: '8px 0 0',
            padding: '4px 12px',
            borderLeft: '3px solid rgba(0,0,0,0.2)',
            color: INK.primary,
            overflowWrap: 'anywhere',
          }}
        >
          {request.note}
        </blockquote>
      )}
      <div style={{color: INK.secondary, fontSize: '0.8125rem', margin: '6px 0 0'}}>
        {I18n.t('Asked %{date}', {date: new Date(request.created_at).toLocaleDateString()})}
      </div>

      {mine === null && (
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8}}>
          <button
            type="button"
            style={button}
            onClick={() => onMode({id: request.id, kind: 'approve'})}
            aria-label={I18n.t('Approve %{parent} for %{student}', {
              parent: observer.name,
              student: student.name,
            })}
          >
            {I18n.t('Approve')}
          </button>
          <button
            type="button"
            style={flatButton}
            onClick={() => onMode({id: request.id, kind: 'decline'})}
            aria-label={I18n.t('Decline %{parent} for %{student}', {
              parent: observer.name,
              student: student.name,
            })}
          >
            {I18n.t('Decline')}
          </button>
        </div>
      )}

      {mine === 'approve' && (
        <div role="group" aria-label={I18n.t('Confirm')} style={{marginTop: 8}}>
          <p style={{margin: '0 0 8px'}}>
            {I18n.t("Let %{parent} see %{student}'s progress, pace and grades?", {
              parent: observer.name,
              student: student.name,
            })}
          </p>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
            <button
              type="button"
              style={button}
              disabled={busy}
              onClick={() => onAnswer('approve')}
            >
              {I18n.t('Yes, approve')}
            </button>
            <button type="button" style={flatButton} onClick={() => onMode(null)}>
              {I18n.t('Cancel')}
            </button>
          </div>
        </div>
      )}

      {mine === 'decline' && (
        <div role="group" aria-label={I18n.t('Decline')} style={{marginTop: 8}}>
          <label style={{display: 'block'}}>
            {I18n.t('Reason for the parent (optional)')}
            <input
              style={field}
              value={reason}
              maxLength={300}
              onChange={event => onReason(event.target.value)}
              placeholder={I18n.t('For example: Please call the front office.')}
            />
          </label>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
            <button
              type="button"
              style={button}
              disabled={busy}
              onClick={() => onAnswer('decline')}
            >
              {I18n.t('Decline request')}
            </button>
            <button type="button" style={flatButton} onClick={() => onMode(null)}>
              {I18n.t('Cancel')}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function AnsweredRow({request}: {request: AdminRequest}) {
  const approved = request.status === 'approved'
  return (
    <li
      style={{padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.08)', overflowWrap: 'anywhere'}}
    >
      <div>
        <strong>{request.observer.name}</strong> → <strong>{request.student.name}</strong>
      </div>
      <div style={{color: INK.secondary, fontSize: '0.875rem'}}>
        <span style={{color: approved ? '#2E7D32' : '#C62828', fontWeight: 500}}>
          {approved ? I18n.t('Approved') : I18n.t('Declined')}
        </span>
        {request.decided_by && ` ${I18n.t('by %{name}', {name: request.decided_by})}`}
        {request.decided_at && ` · ${new Date(request.decided_at).toLocaleDateString()}`}
        {request.response && ` · ${request.response}`}
      </div>
    </li>
  )
}

function RequestsPanel({url}: {url: string}) {
  const [rows, setRows] = useState<AdminRequest[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(() => {
    doFetchApi<{requests: AdminRequest[]}>({path: url})
      .then(({json}) => setRows(json?.requests ?? []))
      .catch(() => setFailed(true))
  }, [url])

  useEffect(() => {
    load()
  }, [load])

  const answer = async (request: AdminRequest, kind: 'approve' | 'decline') => {
    setBusyId(request.id)
    setMessage('')
    try {
      const {json} = await doFetchApi<AdminRequest>({
        path: `${url}/${request.id}/${kind}`,
        method: 'POST',
        body: kind === 'decline' ? {response: reason} : {},
      })
      if (json) setRows(current => current?.map(r => (r.id === json.id ? json : r)) ?? null)
      setMode(null)
      setReason('')
    } catch (e) {
      setMessage(await messageFrom(e))
      // someone else may have answered it first
      load()
    }
    setBusyId(null)
  }

  const waiting = rows?.filter(r => r.status === 'pending') ?? []
  const answered = rows?.filter(r => r.status !== 'pending') ?? []

  return (
    <Card id="pa-requests" title={I18n.t('Requests to follow a student')}>
      {failed && (
        <p role="alert">{I18n.t("The requests didn't load. Reload the page to try again.")}</p>
      )}
      {!failed && rows === null && <p>{I18n.t('Loading...')}</p>}
      {message && (
        <div
          role="alert"
          style={{background: '#FFEBEE', color: '#B71C1C', padding: '12px 16px', borderRadius: 2}}
        >
          {message}
        </div>
      )}
      {rows && (
        <>
          <p style={{margin: '0 0 4px', color: INK.secondary}} data-testid="parents-waiting-count">
            {waiting.length === 0
              ? I18n.t('Nobody is waiting for an answer.')
              : I18n.t(
                  {one: '1 request is waiting.', other: '%{count} requests are waiting.'},
                  {count: waiting.length},
                )}
          </p>
          {waiting.length > 0 && (
            <ul
              aria-label={I18n.t('Waiting requests')}
              style={{listStyle: 'none', margin: 0, padding: 0}}
            >
              {waiting.map(request => (
                <RequestRow
                  key={request.id}
                  request={request}
                  mode={mode}
                  busy={busyId === request.id}
                  reason={reason}
                  onMode={next => {
                    setMode(next)
                    setReason('')
                  }}
                  onReason={setReason}
                  onAnswer={kind => answer(request, kind)}
                />
              ))}
            </ul>
          )}
          {answered.length > 0 && (
            <>
              <h3
                style={{
                  margin: '24px 0 4px',
                  fontFamily: ROBOTO,
                  fontWeight: 400,
                  fontSize: '1rem',
                  color: INK.secondary,
                }}
              >
                {I18n.t('Answered in the last 30 days')}
              </h3>
              <ul
                aria-label={I18n.t('Answered requests')}
                style={{listStyle: 'none', margin: 0, padding: 0}}
              >
                {answered.map(request => (
                  <AnsweredRow key={request.id} request={request} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Card>
  )
}

function FlyerPanel({flyerUrl, resetUrl}: {flyerUrl: string; resetUrl: string}) {
  const [flyer, setFlyer] = useState<Flyer | null>(null)
  const [failed, setFailed] = useState(false)
  const [contact, setContact] = useState(readContact)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    doFetchApi<Flyer>({path: flyerUrl})
      .then(({json}) => setFlyer(json ?? null))
      .catch(() => setFailed(true))
  }, [flyerUrl])

  const print = () => {
    if (!flyer) return
    printHtml(
      flyerHtml(flyerText(), {
        schoolName: flyer.school_name,
        url: flyer.url,
        qrSvg: flyer.qr_svg,
        contact,
      }),
    )
  }

  const reset = async () => {
    setBusy(true)
    setMessage('')
    try {
      const {json} = await doFetchApi<Flyer>({path: resetUrl, method: 'POST'})
      setFlyer(json ?? null)
      setConfirming(false)
      setMessage(I18n.t('Made a new code. Print new flyers; the old ones no longer work.'))
    } catch (e) {
      setMessage(await messageFrom(e))
    }
    setBusy(false)
  }

  return (
    <Card id="pa-flyer" title={I18n.t('Sign-up flyer')}>
      <p style={{margin: '0 0 16px', color: INK.secondary}}>
        {I18n.t(
          'Parents scan the code to make an account, then ask the school to link them to their student. You approve each one here.',
        )}
      </p>
      {failed && (
        <p role="alert">{I18n.t("The flyer didn't load. Reload the page to try again.")}</p>
      )}
      {!failed && !flyer && <p>{I18n.t('Loading...')}</p>}
      {flyer && (
        <>
          <div
            data-testid="parent-flyer-qr"
            style={{width: 'min(100%, 240px)', margin: '0 auto 12px'}}
            // the server draws this SVG from an address it built itself
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{__html: flyer.qr_svg}}
          />
          <p style={{margin: '0 0 16px', textAlign: 'center', overflowWrap: 'anywhere'}}>
            <a href={flyer.url}>{flyer.url}</a>
          </p>
          <label style={{display: 'block'}}>
            {I18n.t('A line for the bottom of the flyer (optional)')}
            <input
              style={field}
              value={contact}
              maxLength={CONTACT_LIMIT}
              onChange={event => {
                setContact(event.target.value)
                saveContact(event.target.value)
              }}
              placeholder={I18n.t('Questions? Call the front office.')}
            />
          </label>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
            <button type="button" style={button} onClick={print}>
              {I18n.t('Print flyer')}
            </button>
            {!confirming && (
              <button type="button" style={flatButton} onClick={() => setConfirming(true)}>
                {I18n.t('Make a new code')}
              </button>
            )}
          </div>
          {confirming && (
            <div role="group" aria-label={I18n.t('Confirm a new code')} style={{marginTop: 16}}>
              <p style={{margin: '0 0 8px'}}>
                {I18n.t(
                  'This stops every flyer already handed out from working. Do it if the code got out to people it should not have.',
                )}
              </p>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
                <button type="button" style={button} disabled={busy} onClick={reset}>
                  {I18n.t('Yes, make a new code')}
                </button>
                <button type="button" style={flatButton} onClick={() => setConfirming(false)}>
                  {I18n.t('Cancel')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <div
        role="status"
        aria-live="polite"
        style={{marginTop: message ? 12 : 0, color: INK.secondary}}
      >
        {message}
      </div>
    </Card>
  )
}

// The school's side of parent accounts: print the sign-up flyer, and decide
// which student each parent who signed up from it may follow.
export default function ParentsApp({config}: {config: ParentsConfig}) {
  return (
    <div
      style={{
        fontFamily: ROBOTO,
        background: SURFACE,
        minHeight: '100%',
        paddingBottom: 'calc(48px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <header
        style={{
          background: ink(APP_BAR),
          color: '#fff',
          boxShadow: ELEVATION[4],
          borderRadius: '2px 2px 0 0',
          overflow: 'hidden',
        }}
      >
        <div aria-hidden="true" style={{display: 'flex', height: 6}}>
          {PALETTE.map(color => (
            <span key={color} style={{flex: 1, background: color}} />
          ))}
        </div>
        <div style={{padding: `clamp(20px, 5vw, 32px) ${PAD} clamp(56px, 10vw, 72px)`}}>
          <h1
            style={{
              margin: '0 0 8px',
              fontFamily: ROBOTO,
              fontWeight: 300,
              fontSize: 'clamp(1.75rem, 0.75rem + 4vw, 3rem)',
              lineHeight: 1.05,
              color: '#fff',
            }}
          >
            {I18n.t('Parents')}
          </h1>
          <p style={{margin: 0, fontSize: 'clamp(1rem, 4vw, 1.125rem)', opacity: 0.92}}>
            {I18n.t('Print the sign-up flyer, and decide which student each parent may follow.')}
          </p>
        </div>
      </header>

      <div
        style={{
          padding: `0 ${GUTTER}`,
          margin: '-40px 0 0',
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26rem), 1fr))',
          gap: 'clamp(12px, 3vw, 20px)',
          alignItems: 'start',
        }}
      >
        <RequestsPanel url={config.requests_url} />
        <FlyerPanel flyerUrl={config.flyer_url} resetUrl={config.reset_url} />
      </div>
    </div>
  )
}
