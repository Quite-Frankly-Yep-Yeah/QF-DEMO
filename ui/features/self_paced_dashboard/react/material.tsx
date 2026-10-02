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

import React, {useRef} from 'react'
import {tokenVar} from '@canvas/material/themes'
import {INK} from './colors'

// Material Design 1 pieces for the dashboard, matching the course map: Roboto,
// 2px corners, and the spec's shadows for each elevation.

export const ROBOTO = "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"

export const ELEVATION = {
  1: '0 1px 3px rgba(0,0,0,0.2), 0 1px 1px rgba(0,0,0,0.14), 0 2px 1px -1px rgba(0,0,0,0.12)',
  2: '0 1px 5px rgba(0,0,0,0.2), 0 2px 2px rgba(0,0,0,0.14), 0 3px 1px -2px rgba(0,0,0,0.12)',
  4: '0 2px 4px -1px rgba(0,0,0,0.2), 0 4px 5px rgba(0,0,0,0.14), 0 1px 10px rgba(0,0,0,0.12)',
  8: '0 5px 5px -3px rgba(0,0,0,0.2), 0 8px 10px 1px rgba(0,0,0,0.14), 0 3px 14px 2px rgba(0,0,0,0.12)',
}

// The app bar color when no single course is chosen (Material blue grey 800).
export const SLATE = '#37474f'

export const SURFACE = tokenVar('surface')
export const PAPER = tokenVar('paper')
export const DIVIDER = tokenVar('divider')
// Text on the white pills and chips that sit on a course-colored app bar. The
// bar's color is the course's, not the theme's, so this stays dark.
export const ON_WHITE = '#0b0b0b'

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map(c => c + c)
          .join('')
      : value
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

// How much black to lay over a color so white text on it reaches 4.5:1. Light
// course colors (yellow, aqua) get darkened more than dark ones.
export function darkenForWhiteText(hex: string): number {
  const base = channels(hex)
  for (let alpha = 0.12; alpha < 0.8; alpha += 0.04) {
    const blended = base.map(c => c * (1 - alpha)) as [number, number, number]
    if (1.05 / (luminance(blended) + 0.05) >= 4.5) return Math.round(alpha * 100) / 100
  }
  return 0.8
}

export function appBarBackground(color: string): string {
  const alpha = darkenForWhiteText(color)
  return `linear-gradient(rgba(0,0,0,${alpha}), rgba(0,0,0,${alpha})), ${color}`
}

// A white card with a title bar, for roster tables and tray sections.
export function Card({
  title,
  aside,
  accent,
  children,
  padded = true,
  clip = true,
  labelledBy,
  level = 2,
}: {
  title?: React.ReactNode
  aside?: React.ReactNode
  accent?: string // a course color down the left edge, like the course map's units
  children: React.ReactNode
  padded?: boolean
  clip?: boolean // off for cards holding a table with sticky headers

  labelledBy?: string
  level?: 2 | 3
}) {
  const Title = level === 3 ? 'h3' : 'h2'
  return (
    <section
      aria-labelledby={labelledBy}
      style={{
        background: PAPER,
        borderRadius: 2,
        boxShadow: ELEVATION[1],
        borderLeft: accent ? `4px solid ${accent}` : undefined,
        margin: '0 0 16px',
        fontFamily: ROBOTO,
        // clipping would stop the table headers from sticking
        overflow: clip ? 'hidden' : 'visible',
      }}
    >
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 16px 8px',
          }}
        >
          <Title
            id={labelledBy}
            style={{
              flex: 1,
              margin: 0,
              fontSize: '1rem',
              fontWeight: 500,
              color: INK.primary,
              fontFamily: ROBOTO,
            }}
          >
            {title}
          </Title>
          {aside}
        </div>
      )}
      <div style={{padding: padded ? '0 16px 16px' : 0}}>{children}</div>
    </section>
  )
}

// A small rounded count or label, like the course map's unit status.
export function Pill({
  children,
  background = 'rgba(0,0,0,0.08)',
  color = INK.primary,
}: {
  children: React.ReactNode
  background?: string
  color?: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: '0.8125rem',
        fontWeight: 500,
        background,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export type TabSpec = {id: string; label: string}

// Material tabs on the app bar: uppercase labels and a white indicator.
// Keyboard: arrows move between tabs, Home and End jump to the ends.
export function AppBarTabs({
  tabs,
  selected,
  onSelect,
  label,
}: {
  tabs: TabSpec[]
  selected: string
  onSelect: (id: string) => void
  label: string
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const move = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length]
    onSelect(tab.id)
    refs.current[tab.id]?.focus()
  }
  return (
    <div role="tablist" aria-label={label} style={{display: 'flex', gap: 8}}>
      {tabs.map((tab, index) => {
        const isSelected = tab.id === selected
        return (
          <button
            key={tab.id}
            ref={node => {
              refs.current[tab.id] = node
            }}
            type="button"
            role="tab"
            id={`${tab.id}-tab`}
            aria-selected={isSelected}
            aria-controls={`${tab.id}-panel`}
            tabIndex={isSelected ? 0 : -1}
            className="self-paced-appbar-tab"
            onClick={() => onSelect(tab.id)}
            onKeyDown={event => {
              if (event.key === 'ArrowRight') move(index + 1)
              else if (event.key === 'ArrowLeft') move(index - 1)
              else if (event.key === 'Home') move(0)
              else if (event.key === 'End') move(tabs.length - 1)
              else return
              event.preventDefault()
            }}
            style={{
              minWidth: 96,
              padding: '14px 16px 12px',
              background: 'none',
              border: 0,
              borderBottom: `2px solid ${isSelected ? '#fff' : 'transparent'}`,
              color: '#fff',
              opacity: isSelected ? 1 : 0.78,
              fontFamily: ROBOTO,
              fontSize: '0.875rem',
              fontWeight: 500,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export const MATERIAL_STYLES = `
  /* Material symbols carry more padding than InstUI's glyphs, so draw them
     a size up (the buttons around them keep their size) */
  .self-paced-page svg[name^="Icon"] { font-size: 1.375rem; }
  .self-paced-roster thead th {
    position: sticky;
    top: var(--sp-sticky-bottom, 0px);
    z-index: 2;
    background: ${PAPER};
    box-shadow: inset 0 -1px 0 ${DIVIDER};
  }
  .self-paced-appbar-tab:hover { background: rgba(255,255,255,0.1) !important; }
  .self-paced-appbar-tab:focus-visible { outline: 2px solid #fff; outline-offset: -4px; }
  .self-paced-seat { transition: box-shadow 150ms ease; }
  .self-paced-seat:hover { box-shadow: ${ELEVATION[8]} !important; }
  .self-paced-seat:focus-visible { outline: 2px solid #2a78d6; outline-offset: 2px; }
  .self-paced-chip:hover { background: #d5d5d5 !important; }
  .self-paced-chip:focus-visible { outline: 2px solid #2a78d6; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .self-paced-seat { transition: none; } }
`
