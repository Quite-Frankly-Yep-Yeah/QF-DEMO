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
import {IconButton} from '@instructure/ui-buttons'
import {IconStarLightLine, IconStarSolid} from '@instructure/ui-icons'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {INK, STATUS_COLORS, tint} from './colors'
import {formatPercent, initials, STUCK_ATTEMPTS} from './format'
import type {Status} from './types'

const I18n = createI18nScope('self_paced_dashboard')

const STATUS_LABELS: Record<Status, () => string> = {
  working: () => I18n.t('Working'),
  idle: () => I18n.t('Idle'),
  away: () => I18n.t('Away'),
}

// Status is shape + word + color, never color alone: a filled dot for working,
// a half-filled dot for idle, an outline for away.
export function StatusShape({status, size = 10}: {status: Status; size?: number}) {
  const color = STATUS_COLORS[status]
  const common = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  }
  if (status === 'working')
    return <span aria-hidden="true" style={{...common, background: color}} />
  if (status === 'idle')
    return (
      <span
        aria-hidden="true"
        style={{
          ...common,
          background: `linear-gradient(90deg, ${color} 50%, transparent 50%)`,
          boxShadow: `inset 0 0 0 2px ${color}`,
        }}
      />
    )
  return <span aria-hidden="true" style={{...common, boxShadow: `inset 0 0 0 2px ${color}`}} />
}

export function StatusBadge({status}: {status: Status | null}) {
  if (!status) return <span style={{color: INK.muted}}>–</span>
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 6, color: INK.primary}}>
      <StatusShape status={status} />
      {STATUS_LABELS[status]()}
    </span>
  )
}

export function StuckBadge({attempts}: {attempts: number}) {
  if (attempts < STUCK_ATTEMPTS) return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 8px',
        borderRadius: 10,
        background: tint(STATUS_COLORS.stuck, 0.12),
        color: '#9e1f1f',
        fontSize: '0.75rem',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">!</span>
      {I18n.t('%{count} tries', {count: attempts})}
    </span>
  )
}

// A course's name with its color. With +href+ it links to the course's page.
export function CourseChip({
  name,
  color,
  href,
}: {
  name: string
  color: string
  href?: string | null
}) {
  const chip = (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%'}}>
      <span
        aria-hidden="true"
        style={{width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0}}
      />
      <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
        {name}
      </span>
    </span>
  )
  if (!href) return chip
  return (
    <a href={href} className="self-paced-course-link" style={{color: 'inherit', maxWidth: '100%'}}>
      {chip}
    </a>
  )
}

// A meter in the course's own color: a pale track of the same hue, so it reads
// as "how far through this course" rather than as a status.
export function ProgressMeter({
  percent,
  color,
  label,
  width = 96,
}: {
  percent: number
  color: string
  label: string
  width?: number | string
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        style={{
          display: 'inline-block',
          width,
          height: 8,
          borderRadius: 4,
          background: tint(color, 0.18),
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${clamped}%`,
            height: '100%',
            borderRadius: 4,
            background: color,
          }}
        />
      </span>
      <span style={{fontVariantNumeric: 'tabular-nums', color: INK.secondary, minWidth: '3ch'}}>
        {formatPercent(clamped)}
      </span>
    </span>
  )
}

// Initials in a circle ringed with the course color. Used large on the live
// board and small in the roster and tray.
export function StudentAvatar({
  name,
  color,
  size = 40,
  status,
}: {
  name: string
  color: string
  size?: number
  status?: Status | null
}) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tint(color, status === 'away' ? 0.08 : 0.16),
          boxShadow: `inset 0 0 0 ${Math.max(2, Math.round(size / 16))}px ${color}`,
          color: INK.primary,
          fontWeight: 500,
          fontSize: size * 0.36,
          opacity: status === 'away' ? 0.7 : 1,
        }}
      >
        {initials(name)}
      </span>
      {status && status !== 'away' && (
        <span
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            background: '#fff',
            borderRadius: '50%',
            padding: 2,
            display: 'flex',
          }}
        >
          <StatusShape status={status} size={Math.max(10, Math.round(size / 4))} />
        </span>
      )}
    </span>
  )
}

export function PinButton({
  pinned,
  studentName,
  onToggle,
}: {
  pinned: boolean
  studentName: string
  onToggle: () => void
}) {
  return (
    <IconButton
      size="small"
      withBackground={false}
      withBorder={false}
      renderIcon={pinned ? <IconStarSolid color="warning" /> : <IconStarLightLine />}
      screenReaderLabel={
        pinned
          ? I18n.t('Remove %{name} from my caseload', {name: studentName})
          : I18n.t('Add %{name} to my caseload', {name: studentName})
      }
      onClick={onToggle}
      aria-pressed={pinned}
    />
  )
}

export {ScreenReaderContent}
