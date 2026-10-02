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

import React, {useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {INK, PAPER, SURFACE} from '@canvas/material'
import {useMaterialPage} from '@canvas/material/useMaterialPage'

const I18n = createI18nScope('self_paced_parent_signup')

const ROBOTO = "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const BRAND = '#1565C0'

export type SignupConfig = {
  valid: boolean
  student_first_name: string | null
  signed_in_as: string | null
  submit_url: string
  login_url: string
  authenticity_token: string
  password_policy?: {minimum_character_length?: number | string} | null
}

type Post = (
  body: Record<string, string>,
) => Promise<{ok: boolean; errors: string[]; redirect?: string}>

// Sends the form the way the rest of the site does: as JSON with the page's
// authenticity token, since the parent has no session yet.
export const postJson =
  (config: SignupConfig): Post =>
  async body => {
    const response = await fetch(config.submit_url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({...body, authenticity_token: config.authenticity_token}),
    })
    const json = await response.json().catch(() => ({}))
    return {
      ok: response.ok,
      errors: Array.isArray(json.errors) ? json.errors : [],
      redirect: json.redirect,
    }
  }

const field: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  margin: '4px 0 16px',
  border: '1px solid #9E9E9E',
  borderRadius: 2,
  font: 'inherit',
  fontSize: '1rem',
}

const button: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  border: 'none',
  borderRadius: 2,
  background: BRAND,
  color: '#fff',
  font: 'inherit',
  fontWeight: 500,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

// The page a parent opens from a QR code: make an account (or, when already
// signed in, add the student to the account they have).
export default function ParentSignupApp({
  config,
  post = postJson(config),
  go = (url: string) => window.location.assign(url),
}: {
  config: SignupConfig
  post?: Post
  go?: (url: string) => void
}) {
  useMaterialPage()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const send = async (body: Record<string, string>) => {
    setBusy(true)
    setErrors([])
    try {
      const result = await post(body)
      if (result.ok) {
        go(result.redirect ?? '/')
        return
      }
      setErrors(
        result.errors.length > 0 ? result.errors : [I18n.t("That didn't work. Please try again.")],
      )
    } catch {
      setErrors([I18n.t("That didn't work. Please try again.")])
    }
    setBusy(false)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== confirm) {
      setErrors([I18n.t("The passwords don't match.")])
      return
    }
    send({name, email, password, password_confirmation: confirm})
  }

  const minLength = Number(config.password_policy?.minimum_character_length) || 8
  const student = config.student_first_name ?? ''
  // The school's flyer (SelfPaced::SchoolParentSignup) isn't tied to a
  // student, unlike a staff invite code, so there is no name to greet with.
  const hasStudent = config.student_first_name !== null

  return (
    <div style={{fontFamily: ROBOTO, background: SURFACE, minHeight: '100vh', padding: '0 0 48px'}}>
      <div style={{height: 6, background: BRAND}} aria-hidden="true" />
      <main
        style={{
          maxWidth: 440,
          margin: '48px auto 0',
          background: PAPER,
          borderRadius: 2,
          boxShadow: '0 2px 5px rgba(0,0,0,0.26), 0 2px 10px rgba(0,0,0,0.16)',
          padding: '32px',
        }}
      >
        {!config.valid ? (
          <>
            <h1 style={{margin: '0 0 12px', fontWeight: 300, fontSize: '2rem'}}>
              {I18n.t("This invitation doesn't work")}
            </h1>
            <p data-testid="signup-invalid" style={{margin: 0, color: INK.secondary}}>
              {I18n.t(
                "It has already been used or it has expired. Ask your student's school for a new QR code.",
              )}
            </p>
          </>
        ) : config.signed_in_as ? (
          <>
            <h1 style={{margin: '0 0 12px', fontWeight: 300, fontSize: '2rem'}}>
              {hasStudent
                ? I18n.t('Add %{student} to your account', {student})
                : I18n.t('Set up your parent account')}
            </h1>
            <p style={{color: INK.secondary}}>
              {hasStudent
                ? I18n.t(
                    "You're signed in as %{name}. You'll be able to see how %{student} is doing.",
                    {
                      name: config.signed_in_as,
                      student,
                    },
                  )
                : I18n.t(
                    "You're signed in as %{name}. Next you'll look up your student so the school can link them.",
                    {name: config.signed_in_as},
                  )}
            </p>
            {errors.length > 0 && <Errors errors={errors} />}
            <button type="button" style={button} disabled={busy} onClick={() => send({})}>
              {hasStudent ? I18n.t('Add %{student}', {student}) : I18n.t('Continue')}
            </button>
          </>
        ) : (
          <>
            <h1 style={{margin: '0 0 8px', fontWeight: 300, fontSize: '2rem', lineHeight: 1.15}}>
              {hasStudent
                ? I18n.t("Follow %{student}'s progress", {student})
                : I18n.t('Find your student')}
            </h1>
            <p style={{margin: '0 0 24px', color: INK.secondary}}>
              {hasStudent
                ? I18n.t(
                    'Make your account to see progress, grades and time spent in their self-paced classes.',
                  )
                : I18n.t(
                    'Make your account, then look up your student so the school can link them to you.',
                  )}
            </p>
            {errors.length > 0 && <Errors errors={errors} />}
            <form onSubmit={submit} noValidate={true}>
              <label>
                {I18n.t('Your full name')}
                <input
                  style={field}
                  value={name}
                  onChange={event => setName(event.target.value)}
                  autoComplete="name"
                  required={true}
                />
              </label>
              <label>
                {I18n.t('Email')}
                <input
                  style={field}
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  autoComplete="email"
                  required={true}
                />
              </label>
              <label>
                {I18n.t('Password')}
                <input
                  style={{...field, marginBottom: 4}}
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required={true}
                />
              </label>
              <div style={{fontSize: '0.8125rem', color: INK.secondary, marginBottom: 16}}>
                {I18n.t('At least %{count} characters.', {count: minLength})}
              </div>
              <label>
                {I18n.t('Type your password again')}
                <input
                  style={field}
                  type="password"
                  value={confirm}
                  onChange={event => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  required={true}
                />
              </label>
              <button type="submit" style={button} disabled={busy}>
                {busy ? I18n.t('Making your account...') : I18n.t('Create my account')}
              </button>
            </form>
            <p style={{margin: '24px 0 0', color: INK.secondary, fontSize: '0.875rem'}}>
              {I18n.t('Already have an account?')}{' '}
              <a href={config.login_url}>
                {hasStudent ? I18n.t('Log in to add %{student}', {student}) : I18n.t('Log in')}
              </a>
            </p>
          </>
        )}
      </main>
    </div>
  )
}

function Errors({errors}: {errors: string[]}) {
  return (
    <div
      role="alert"
      style={{
        background: '#FFEBEE',
        color: '#B71C1C',
        padding: '12px 16px',
        margin: '0 0 16px',
        borderRadius: 2,
      }}
    >
      <ul style={{margin: 0, paddingLeft: 18}}>
        {errors.map(message => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  )
}
