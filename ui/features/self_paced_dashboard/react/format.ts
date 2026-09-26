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

import {useScope as createI18nScope} from '@canvas/i18n'
import type {RosterRow} from './types'

const I18n = createI18nScope('self_paced_dashboard')

// Attempts on one item before a student counts as stuck. Phase 6 alert rules
// will make this configurable.
export const STUCK_ATTEMPTS = 3

export function isStuck(row: Pick<RosterRow, 'attempts_on_current_item'>): boolean {
  return row.attempts_on_current_item >= STUCK_ATTEMPTS
}

// "0 min", "42 min", "1 h 5 min"
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  if (minutes < 60) return I18n.t('%{minutes} min', {minutes})
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0
    ? I18n.t('%{hours} h', {hours})
    : I18n.t('%{hours} h %{minutes} min', {hours, minutes: rest})
}

export function secondsSince(iso: string | null, now: Date): number {
  if (!iso) return 0
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000)
}

// "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", "never"
export function formatLastActive(iso: string | null, now: Date): string {
  if (!iso) return I18n.t('never')
  const minutes = Math.floor(secondsSince(iso, now) / 60)
  if (minutes < 1) return I18n.t('just now')
  if (minutes < 60) return I18n.t('%{count} min ago', {count: minutes})
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return I18n.t('%{count} h ago', {count: hours})
  const days = Math.floor(hours / 24)
  if (days === 1) return I18n.t('yesterday')
  return I18n.t('%{count} days ago', {count: days})
}

export function formatPercent(value: number): string {
  return I18n.t('%{percent}%', {percent: Math.round(value)})
}

export function formatScore(score: number | null): string {
  return score === null || score === undefined ? '–' : formatPercent(score)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)),
    template,
  )
}
