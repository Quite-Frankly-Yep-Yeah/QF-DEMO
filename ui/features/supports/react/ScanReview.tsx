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
import {ELEVATION, INK} from '../../self_paced_home/react/material'
import ScanCard from './ScanCard'
import type {ReviewEdits, ScanRecord} from './types'
import {button, Card, field, flatButton, Label, muted} from './ui'

const I18n = createI18nScope('supports')

const PLAN_TYPES = [
  {value: 'iep', label: 'IEP'},
  {value: '504', label: '504 plan'},
  {value: 'el', label: 'English-learner plan'},
  {value: 'other', label: 'Other plan'},
]

// Why Apply is off, in words; null when it can be used.
export function applyBlocker(record: ScanRecord): string | null {
  const scan = record.scan
  if (!scan.plan_type) return I18n.t('Choose a plan type.')
  if ((record.summary.blocking ?? 0) > 0) return I18n.t('Fix the items marked with problems first.')
  if (scan.mismatch && !scan.acknowledged_mismatch) {
    return I18n.t('Confirm that this is the right student first.')
  }
  return null
}

// What a scan found, ready to check: the plan, each accommodation with the
// words it came from, and what could not be matched. Nothing is saved until
// Apply.
export default function ScanReview({
  record,
  busy,
  onEdit,
  onApply,
  onDiscard,
  onUndo,
  onReset,
}: {
  record: ScanRecord
  busy: boolean
  onEdit: (edits: ReviewEdits) => void
  onApply: () => void
  onDiscard: () => void
  onUndo: () => void
  onReset: () => void
}) {
  const scan = record.scan
  const previewing = record.workflow_state === 'previewed'
  const blocker = applyBlocker(record)
  const unmapped = scan.unmapped ?? []
  const kept = scan.keep_unmapped ?? []

  const toggleKept = (index: number, keep: boolean) =>
    onEdit({
      keep_unmapped: keep ? [...kept, index].sort((a, b) => a - b) : kept.filter(i => i !== index),
    })

  return (
    <div style={{display: 'grid', gap: 'clamp(12px, 3vw, 16px)'}}>
      {previewing && scan.mismatch && (
        <div
          role="alert"
          style={{
            background: '#FFF3E0',
            borderLeft: '4px solid #E65100',
            borderRadius: 2,
            boxShadow: ELEVATION[2],
            padding: '12px 16px',
            color: INK.primary,
          }}
        >
          <p style={{margin: '0 0 8px', fontWeight: 500}}>
            {I18n.t('This document names a different student: %{name}.', {
              name: scan.student_name_on_doc ?? '',
            })}
          </p>
          <label style={{display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44}}>
            <input
              type="checkbox"
              checked={!!scan.acknowledged_mismatch}
              disabled={busy}
              onChange={event => onEdit({acknowledged_mismatch: event.target.checked})}
            />
            {I18n.t('This is the right student')}
          </label>
        </div>
      )}
      {previewing && scan.name_found === false && (
        <p style={{...muted, margin: 0}}>
          {I18n.t("No student name was found in the document, so it couldn't be checked.")}
        </p>
      )}

      <Card id="scan-plan" title={I18n.t('Plan')}>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 16}}>
          <div style={{flex: '1 1 12rem'}}>
            <Label text={I18n.t('Plan type')}>
              <select
                style={field}
                value={scan.plan_type ?? ''}
                disabled={!previewing || busy}
                onChange={event => onEdit({plan: {plan_type: event.target.value}})}
              >
                {!scan.plan_type && <option value="">{I18n.t('Choose…')}</option>}
                {PLAN_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {I18n.t(type.label)}
                  </option>
                ))}
              </select>
            </Label>
          </div>
          <div style={{flex: '1 1 10rem'}}>
            <Label text={I18n.t('Start date')}>
              <input
                style={field}
                type="date"
                value={scan.start_date ?? ''}
                disabled={!previewing || busy}
                onChange={event => onEdit({plan: {start_date: event.target.value}})}
              />
            </Label>
          </div>
          <div style={{flex: '1 1 10rem'}}>
            <Label text={I18n.t('End date')}>
              <input
                style={field}
                type="date"
                value={scan.end_date ?? ''}
                disabled={!previewing || busy}
                onChange={event => onEdit({plan: {end_date: event.target.value}})}
              />
            </Label>
          </div>
        </div>
      </Card>

      <section aria-label={I18n.t('Accommodations found')} style={{display: 'grid', gap: 12}}>
        {record.rows.length === 0 && (
          <p style={{...muted, margin: 0}}>
            {I18n.t('No accommodations in your catalog were found in this document.')}
          </p>
        )}
        {record.rows.map(row => (
          <ScanCard
            key={row.index}
            item={row}
            disabled={!previewing || busy}
            onChange={edit => onEdit({items: [{index: row.index, ...edit}]})}
          />
        ))}
      </section>

      {unmapped.length > 0 && (
        <Card id="scan-unmapped" title={I18n.t('Not mapped')}>
          <p style={{...muted, margin: '0 0 8px'}}>
            {I18n.t(
              "These didn't match anything in your catalog. Keep one as a note on the plan, or leave it out.",
            )}
          </p>
          <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
            {unmapped.map((note, index) => (
              <li key={`${index}-${note.text}`}>
                <label style={{display: 'flex', alignItems: 'center', gap: 8, minHeight: 44}}>
                  <input
                    type="checkbox"
                    checked={kept.includes(index)}
                    disabled={!previewing || busy}
                    onChange={event => toggleKept(index, event.target.checked)}
                  />
                  <span>
                    {I18n.t('Keep as a note on the plan: %{text}', {text: note.text})}
                    {note.page !== null && ` (${I18n.t('page %{page}', {page: note.page})})`}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12}}>
        {previewing ? (
          <>
            <button
              type="button"
              style={{...button, opacity: blocker || busy ? 0.5 : 1}}
              disabled={busy || !!blocker}
              onClick={onApply}
            >
              {I18n.t('Apply')}
            </button>
            <button type="button" style={flatButton} disabled={busy} onClick={onDiscard}>
              {I18n.t('Discard')}
            </button>
            {blocker && <span style={muted}>{blocker}</span>}
          </>
        ) : (
          <>
            {record.workflow_state === 'applied' && (
              <button type="button" style={flatButton} disabled={busy} onClick={onUndo}>
                {I18n.t('Undo')}
              </button>
            )}
            <button type="button" style={flatButton} onClick={onReset}>
              {I18n.t('Scan another')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
