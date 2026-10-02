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

import React from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {ELEVATION, INK, ROBOTO} from '../../self_paced_home/react/material'
import {PAPER} from '@canvas/material'

const I18n = createI18nScope('supports')

// Shared look for the Supports page: the Material 1 cards, buttons and fields
// the Parents page uses, in the page's own purple.
export const BRAND = '#6A1B9A'
// BRAND as text: purple in Light, the theme's accent text elsewhere (see _themes.scss)
export const BRAND_TEXT = 'var(--qf-brand-text, #6A1B9A)'
export const TAP = 44
export const GUTTER = 'clamp(8px, calc((100vw - 30rem) / 8), 32px)'
export const PAD = 'clamp(16px, 5vw, 32px)'

export const button: React.CSSProperties = {
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

export const flatButton: React.CSSProperties = {
  ...button,
  background: 'transparent',
  color: BRAND_TEXT,
  boxShadow: 'none',
  padding: '0 12px',
}

export const field: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 44,
  padding: '10px 12px',
  margin: '4px 0 12px',
  border: '1px solid #9E9E9E',
  borderRadius: 2,
  font: 'inherit',
  fontSize: '1rem',
  background: PAPER,
}

export const muted: React.CSSProperties = {color: INK.secondary, fontSize: '0.875rem'}

export function Card({
  id,
  title,
  aside,
  children,
}: {
  id: string
  title: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      style={{
        background: PAPER,
        borderRadius: 2,
        boxShadow: ELEVATION[4],
        padding: 'clamp(16px, 4vw, 24px) clamp(16px, 4.5vw, 24px)',
        fontFamily: ROBOTO,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          margin: '0 0 12px',
        }}
      >
        <h2
          id={id}
          style={{
            margin: 0,
            fontFamily: ROBOTO,
            fontWeight: 300,
            fontSize: 'clamp(1.25rem, 1rem + 1vw, 1.5rem)',
            color: INK.primary,
          }}
        >
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Label({text, children}: {text: string; children: React.ReactNode}) {
  return (
    <label style={{display: 'block', fontWeight: 500, color: INK.primary}}>
      {text}
      {children}
    </label>
  )
}

// What the server said when it refused, or a general message.
export async function messageFrom(error: unknown): Promise<string> {
  const response = (error as {response?: Response} | null)?.response
  try {
    const json = await response?.json()
    if (Array.isArray(json?.errors) && json.errors.length > 0) return json.errors.join(' ')
    if (typeof json?.message === 'string') return json.message
  } catch {
    // fall through
  }
  return I18n.t("That didn't work. Please try again.")
}

export function Status({message}: {message: string}) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{marginTop: message ? 12 : 0, color: INK.secondary}}
    >
      {message}
    </div>
  )
}

export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
