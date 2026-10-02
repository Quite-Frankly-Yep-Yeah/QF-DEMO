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
import {ACCENT_GROUPS, accentHex, tokensWithAccent} from '@canvas/material/accents'
import {ACCENT, ACCENT_TEXT, DIVIDER, ELEVATION, INK, PAPER, ROBOTO} from '@canvas/material'
import {THEMES, type ThemeId} from '@canvas/material/themes'
import {IconCheckSolid} from '@instructure/ui-icons'

const I18n = createI18nScope('account_sidebar')

type Props = {
  theme: ThemeId
  accent: string | null
  onChoose: (id: ThemeId) => void
  onChooseAccent: (id: string | null) => void
}

// A miniature page in the theme's own colors, like the thumbnails on the admin
// Themes page: app bar, a card with text, a progress bar, a radio, a checkbox
// and two buttons.
function Preview({id, accent}: {id: ThemeId; accent: string | null}) {
  const t = tokensWithAccent(id, accent)
  const line = (width: string, height: number, color: string, extra = {}) => (
    <div style={{width, height, borderRadius: height / 2, background: color, ...extra}} />
  )
  return (
    <div
      aria-hidden="true"
      data-testid={`theme-preview-${id}`}
      style={{
        height: 92,
        overflow: 'hidden',
        borderRadius: 4,
        background: t.surface,
        border: `1px solid ${t.divider}`,
      }}
    >
      <div
        data-testid={`theme-preview-bar-${id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 16,
          padding: '0 8px',
          background: t.appBar,
        }}
      >
        {line('22%', 4, t.onAppBar)}
        <div style={{flex: 1}} />
        {line('10%', 3, t.onAppBar, {opacity: 0.7})}
        {line('10%', 3, t.onAppBar, {opacity: 0.7})}
      </div>
      <div
        data-testid={`theme-preview-card-${id}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          margin: 8,
          padding: 7,
          borderRadius: 3,
          background: t.paper,
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }}
      >
        {line('55%', 4, t.ink)}
        {line('85%', 3, t.inkSecondary)}
        <div style={{height: 4, borderRadius: 2, background: t.divider}}>
          <div
            data-testid={`theme-preview-accent-${id}`}
            style={{width: '55%', height: 4, borderRadius: 2, background: t.accent}}
          />
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              border: `2px solid ${t.accent}`,
              boxSizing: 'border-box',
            }}
          />
          <div style={{width: 8, height: 8, borderRadius: 2, background: t.accent}} />
          <div style={{flex: 1}} />
          <div style={{width: 26, height: 8, borderRadius: 2, background: t.accent}} />
          <div style={{width: 26, height: 8, borderRadius: 2, background: t.divider}} />
        </div>
      </div>
    </div>
  )
}

// The speech bubble: a paper panel with a tail pointing back at the button
// that opened it, holding a grid of theme cards.
export default function ThemePopover({theme, accent, onChoose, onChooseAccent}: Props) {
  return (
    <div
      style={{
        position: 'relative',
        width: 480,
        maxWidth: '90vw',
        padding: 12,
        boxSizing: 'border-box',
        borderRadius: 8,
        background: PAPER,
        boxShadow: ELEVATION[8],
        fontFamily: ROBOTO,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: -6,
          width: 12,
          height: 12,
          marginTop: -6,
          background: PAPER,
          transform: 'rotate(45deg)',
          boxShadow: '-2px 2px 3px rgba(0,0,0,0.12)',
        }}
      />
      <div
        role="radiogroup"
        aria-label={I18n.t('Themes')}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}
      >
        {(Object.keys(THEMES) as ThemeId[]).map(id => {
          const active = id === theme
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChoose(id)}
              style={{
                display: 'block',
                padding: 8,
                border: `2px solid ${active ? ACCENT : DIVIDER}`,
                borderRadius: 6,
                background: 'transparent',
                color: INK.primary,
                cursor: 'pointer',
                font: 'inherit',
                textAlign: 'start',
              }}
            >
              <Preview id={id} accent={accent} />
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginTop: 8,
                  fontSize: '0.875rem',
                }}
              >
                <span style={{fontWeight: active ? 500 : 400}}>{THEMES[id].name}</span>
                {active && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: ACCENT_TEXT,
                      fontSize: '0.75rem',
                    }}
                  >
                    <IconCheckSolid size="x-small" />
                    {I18n.t('Current theme')}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
      <AccentFooter theme={theme} accent={accent} onChooseAccent={onChooseAccent} />
    </div>
  )
}

const SWATCH = 24

function swatchLabel(id: string): string {
  const [group, key] = id.split(':')
  const list = group === 'material' ? ACCENT_GROUPS.material : ACCENT_GROUPS.catppuccin
  const name = list.find(item => item.id === key)?.name ?? key
  return group === 'material'
    ? I18n.t('%{name} (Material)', {name})
    : I18n.t('%{name} (Catppuccin)', {name})
}

function Swatch({
  color,
  label,
  checked,
  onPick,
}: {
  color: string
  label: string
  checked: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onPick}
      style={{
        width: SWATCH,
        height: SWATCH,
        padding: 0,
        border: `2px solid ${checked ? INK.primary : 'transparent'}`,
        borderRadius: '50%',
        background: color,
        boxShadow: `inset 0 0 0 2px ${PAPER}`,
        cursor: 'pointer',
      }}
    />
  )
}

// The accent colors under the theme cards: Material colors, then Catppuccin's
// in the current flavor's shade, and a way back to the theme's own accent.
function AccentFooter({
  theme,
  accent,
  onChooseAccent,
}: {
  theme: ThemeId
  accent: string | null
  onChooseAccent: (id: string | null) => void
}) {
  // Light is the Material theme; every Catppuccin flavor shows Catppuccin's accents.
  const family = theme === 'light' ? 'material' : 'catppuccin'
  // A saved accent from the other family stays visible (checked) so it can be reset.
  const foreign = accent !== null && !accent.startsWith(`${family}:`)
  const row = {display: 'flex', flexWrap: 'wrap' as const, gap: 6, alignItems: 'center'}
  const heading = {margin: '10px 0 6px', fontSize: '0.75rem', color: INK.secondary}
  return (
    <div
      role="radiogroup"
      aria-label={I18n.t('Accent color')}
      style={{
        position: 'relative',
        marginTop: 12,
        paddingTop: 10,
        borderTop: `1px solid ${DIVIDER}`,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <span style={{fontSize: '0.875rem', fontWeight: 500}}>{I18n.t('Accent color')}</span>
        <button
          type="button"
          role="radio"
          aria-checked={accent === null}
          onClick={() => onChooseAccent(null)}
          style={{
            padding: '4px 10px',
            border: `1px solid ${accent === null ? ACCENT : DIVIDER}`,
            borderRadius: 12,
            background: 'transparent',
            color: INK.primary,
            cursor: 'pointer',
            font: 'inherit',
            fontSize: '0.75rem',
          }}
        >
          {I18n.t('Theme default')}
        </button>
      </div>
      <div style={heading}>{family === 'material' ? I18n.t('Material') : I18n.t('Catppuccin')}</div>
      <div style={row}>
        {foreign && (
          <Swatch
            color={accentHex(accent!, theme)}
            label={swatchLabel(accent!)}
            checked={true}
            onPick={() => onChooseAccent(accent)}
          />
        )}
        {ACCENT_GROUPS[family].map(item => {
          const id = `${family}:${item.id}`
          return (
            <Swatch
              key={id}
              color={accentHex(id, theme)}
              label={swatchLabel(id)}
              checked={accent === id}
              onPick={() => onChooseAccent(id)}
            />
          )
        })}
      </div>
    </div>
  )
}
