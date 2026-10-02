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

import React, {useEffect, useRef} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {ELEVATION, INK, ink, ROBOTO, tint} from './material'
import {SURFACE} from '@canvas/material'

const I18n = createI18nScope('course_catalog')

export const CATALOG_STYLES = `.cc-raised { transition: box-shadow 0.2s; }
.cc-raised:hover:not(:disabled) { box-shadow: ${ELEVATION[8]} !important; }
.cc-raised:focus-visible, .cc-flat:focus-visible, .cc-input:focus-visible { outline: 2px solid #2B7ABC; outline-offset: 2px; }
.cc-raised:disabled { opacity: 0.5; cursor: default; }
.cc-flat:hover:not(:disabled) { background: rgba(0,0,0,0.08); }
.cc-card { transition: box-shadow 0.2s; }
.cc-card:hover { box-shadow: ${ELEVATION[8]} !important; }
.cc-row:hover { background: rgba(0,0,0,0.06); }
@media (prefers-reduced-motion: reduce) { .cc-raised, .cc-card { transition: none; } }`

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {color?: string}

// A raised Material button: white text on a color.
export function RaisedButton({color = '#2B7ABC', style, children, ...rest}: ButtonProps) {
  return (
    <button
      type="button"
      className="cc-raised"
      style={{
        padding: '9px 16px',
        border: 0,
        borderRadius: 2,
        background: ink(color),
        color: '#fff',
        fontFamily: ROBOTO,
        fontSize: '0.875rem',
        fontWeight: 500,
        letterSpacing: '0.75px',
        textTransform: 'uppercase',
        boxShadow: ELEVATION[2],
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

// A flat Material button: the color as text, no fill.
export function FlatButton({color = '#2B7ABC', style, children, ...rest}: ButtonProps) {
  return (
    <button
      type="button"
      className="cc-flat"
      style={{
        padding: '9px 12px',
        border: 0,
        borderRadius: 2,
        background: 'transparent',
        color: ink(color),
        fontFamily: ROBOTO,
        fontSize: '0.875rem',
        fontWeight: 500,
        letterSpacing: '0.75px',
        textTransform: 'uppercase',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Pill({color, children}: {color: string; children: React.ReactNode}) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 12,
        background: tint(color, 0.16),
        color: ink(color),
        fontSize: '0.75rem',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// A modal dialog: Escape and Cancel close it, focus starts inside it and
// returns to whatever had it when it closes.
export function Dialog({
  title,
  onClose,
  actions,
  children,
}: {
  title: string
  onClose: () => void
  actions: React.ReactNode
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input, button')?.focus()
    return () => previous?.focus?.()
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={event => {
          if (event.key === 'Escape') onClose()
        }}
        style={{
          width: 'min(100%, 28rem)',
          background: SURFACE,
          borderRadius: 2,
          boxShadow: ELEVATION[8],
          fontFamily: ROBOTO,
          color: INK.primary,
        }}
      >
        <h2 style={{margin: 0, padding: '24px 24px 8px', fontSize: '1.25rem', fontWeight: 500}}>
          {title}
        </h2>
        <div style={{padding: '8px 24px 16px'}}>{children}</div>
        <div
          style={{display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 16px 16px'}}
        >
          {actions}
        </div>
      </div>
    </div>
  )
}

export function Snackbar({message, onDismiss}: {message: string; onDismiss: () => void}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 6000)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 24,
        bottom: 24,
        zIndex: 1100,
        maxWidth: 'calc(100vw - 48px)',
        padding: '14px 24px',
        borderRadius: 2,
        background: '#323232',
        color: '#fff',
        fontFamily: ROBOTO,
        fontSize: '0.875rem',
        boxShadow: ELEVATION[4],
      }}
    >
      {message}{' '}
      <button
        type="button"
        className="cc-flat"
        onClick={onDismiss}
        style={{
          marginLeft: 16,
          border: 0,
          background: 'transparent',
          color: '#90CAF9',
          font: 'inherit',
          fontWeight: 500,
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        {I18n.t('Dismiss')}
      </button>
    </div>
  )
}
