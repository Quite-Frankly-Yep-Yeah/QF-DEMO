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
import {ELEVATION, INK, ink, PALETTE, tint} from '../../self_paced_home/react/material'
import ParametersFields from './ParametersFields'
import type {Kind, Parameters, ScanItem} from './types'
import {flatButton, muted} from './ui'
import {PAPER} from '@canvas/material'

const I18n = createI18nScope('supports')

const KINDS: Kind[] = [
  'extended_time',
  'extended_deadlines',
  'extra_attempts',
  'reduced_workload',
  'check_ins',
  'display',
  'informational',
]

const kindLabel = (kind: Kind) => {
  switch (kind) {
    case 'extended_time':
      return I18n.t('Extended time')
    case 'extended_deadlines':
      return I18n.t('Extended deadlines')
    case 'extra_attempts':
      return I18n.t('Extra attempts')
    case 'reduced_workload':
      return I18n.t('Reduced workload')
    case 'check_ins':
      return I18n.t('Check-ins')
    case 'display':
      return I18n.t('Display')
    default:
      return I18n.t('For the teacher')
  }
}

const confidenceLabel = (confidence: ScanItem['confidence']) => {
  switch (confidence) {
    case 'high':
      return I18n.t('Confident')
    case 'medium':
      return I18n.t('Check this')
    default:
      return I18n.t('Low confidence: check this one')
  }
}

// What the settings mean in plain words (the server says the same on a plan).
export function parametersText(kind: Kind, params: Parameters | null): string {
  const value = params ?? {}
  switch (kind) {
    case 'extended_time':
      return value.multiplier !== undefined
        ? I18n.t('%{multiplier}x time on timed quizzes', {multiplier: Number(value.multiplier)})
        : I18n.t('%{minutes} extra minutes on timed quizzes', {minutes: Number(value.minutes ?? 0)})
    case 'extended_deadlines':
      return value.mode === 'lower_daily'
        ? I18n.t('Daily work target lowered by %{percent}%', {percent: Number(value.percent ?? 0)})
        : I18n.t('Finish date moved out by %{percent}%', {percent: Number(value.percent ?? 0)})
    case 'extra_attempts':
      return I18n.t('%{count} extra attempts on quizzes', {count: Number(value.attempts ?? 0)})
    case 'check_ins':
      return I18n.t('Check in every %{days} days', {days: Number(value.every_days ?? 0)})
    case 'display':
      return value.setting === 'use_dyslexic_font'
        ? I18n.t('Dyslexia-friendly font')
        : I18n.t('High contrast display')
    default:
      return ''
  }
}

// What applying this item does to what the student already has.
const actionLabel = (action: ScanItem['action']) => {
  switch (action) {
    case 'create_plan':
      return I18n.t('Starts a new plan')
    case 'update_plan':
      return I18n.t("Changes the existing plan's details")
    case 'add':
      return I18n.t('Added to the plan')
    case 'update':
      return I18n.t('Changes an existing accommodation')
    case 'unchanged':
      return I18n.t('Already on the plan, no change')
    default:
      return ''
  }
}

const hasSettings = (kind: Kind) => kind !== 'informational' && kind !== 'reduced_workload'

// One accommodation the scan found: what it is, the words in the IEP it came
// from, and the controls to leave it out or change its settings.
export default function ScanCard({
  item,
  onChange,
  disabled = false,
}: {
  item: ScanItem
  onChange: (edit: {included?: boolean; params?: Parameters}) => void
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  // changes are held here and sent on Save, so typing isn't sent a key at a time
  const [draft, setDraft] = useState<Parameters>({})
  const color = PALETTE[Math.max(0, KINDS.indexOf(item.kind)) % PALETTE.length]
  const name = item.accommodation ?? kindLabel(item.kind)
  const headingId = `scan-item-${item.index}`
  const summary = parametersText(item.kind, item.params)
  const effect = actionLabel(item.action)

  return (
    <article
      aria-labelledby={headingId}
      style={{
        background: PAPER,
        borderRadius: 2,
        borderLeft: `4px solid ${color}`,
        boxShadow: item.errors.length > 0 ? ELEVATION[4] : ELEVATION[2],
        padding: '12px 16px',
        opacity: item.included ? 1 : 0.6,
        minWidth: 0,
      }}
    >
      <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8}}>
        <h3
          id={headingId}
          style={{
            margin: 0,
            fontWeight: 500,
            fontSize: '1rem',
            color: INK.primary,
            flex: '1 1 12rem',
          }}
        >
          {name}
        </h3>
        <span
          style={{
            background: tint(color, 0.14),
            color: ink(color),
            borderRadius: 2,
            padding: '2px 8px',
            fontSize: '0.75rem',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {kindLabel(item.kind)}
        </span>
        <label style={{display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44}}>
          <input
            type="checkbox"
            checked={item.included}
            disabled={disabled}
            aria-label={I18n.t('Include %{name}', {name})}
            onChange={event => onChange({included: event.target.checked})}
          />
          {I18n.t('Include')}
        </label>
      </div>

      {summary && <p style={{margin: '4px 0 0', color: INK.primary}}>{summary}</p>}

      <blockquote
        style={{
          margin: '8px 0 0',
          padding: '0 0 0 12px',
          borderLeft: '2px solid #BDBDBD',
          ...muted,
        }}
      >
        {'“'}
        {item.source_quote}
        {'”'}
        {item.page !== null && <span> {I18n.t('Page %{page}', {page: item.page})}</span>}
      </blockquote>

      <p style={{margin: '8px 0 0', ...muted}}>{confidenceLabel(item.confidence)}</p>
      {effect && <p style={{margin: '4px 0 0', fontWeight: 500, color: INK.primary}}>{effect}</p>}

      {item.errors.length > 0 && (
        <ul role="alert" style={{margin: '8px 0 0', paddingLeft: 20, color: '#B71C1C'}}>
          {item.errors.map(error => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {hasSettings(item.kind) && (
        <div style={{marginTop: 8}}>
          {!editing && (
            <button
              type="button"
              style={flatButton}
              aria-expanded={false}
              disabled={disabled}
              onClick={() => {
                setDraft(item.params ?? {})
                setEditing(true)
              }}
            >
              {I18n.t('Edit settings')}
            </button>
          )}
          {editing && (
            <>
              <ParametersFields
                kind={item.kind}
                value={draft}
                onChange={setDraft}
                idPrefix={`scan-${item.index}`}
              />
              <button
                type="button"
                style={flatButton}
                disabled={disabled}
                onClick={() => {
                  onChange({params: draft})
                  setEditing(false)
                }}
              >
                {I18n.t('Save settings')}
              </button>
              <button type="button" style={flatButton} onClick={() => setEditing(false)}>
                {I18n.t('Cancel')}
              </button>
            </>
          )}
        </div>
      )}
    </article>
  )
}
