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

const I18n = createI18nScope('self_paced_pacing')

// Shapes of GET /api/v1/courses/:course_id/self_paced/pacing (SelfPaced::Pacer#as_json)

export type ChartPoint = [string, number] // [YYYY-MM-DD, percent]

export type PacingGoal = {total: number; done: number; minutes: number}

export type PacingItem = {
  id: string
  title: string
  type: string
  url: string
  planned_date: string | null
  completed: boolean
}

export type Pacing = {
  start_date: string
  target_date: string
  target_source: 'default' | 'teacher'
  days_ahead: number
  expected_percent: number
  percent_complete: number
  finished: boolean
  daily_minutes: number
  today: PacingGoal & {item_ids: string[]}
  week: PacingGoal
  items: PacingItem[]
  chart: {
    baseline: ChartPoint[]
    actual: ChartPoint[]
    projected: ChartPoint[]
    today: string
    total_minutes: number
  }
  can_adjust: boolean
}

export type PaceTone = 'finished' | 'ahead' | 'on_pace' | 'behind' | 'far_behind'

// How far behind before it's worth a stronger signal.
export const FAR_BEHIND_DAYS = 3

export function paceTone(daysAhead: number | null | undefined, finished = false): PaceTone | null {
  if (finished) return 'finished'
  if (daysAhead === null || daysAhead === undefined) return null
  if (daysAhead > 0) return 'ahead'
  if (daysAhead === 0) return 'on_pace'
  return -daysAhead >= FAR_BEHIND_DAYS ? 'far_behind' : 'behind'
}

// Reserved state colors (the dashboard's working / idle / stuck), always shown
// next to a shape and a word.
export const PACE_COLORS: Record<PaceTone, string> = {
  finished: '#0ca30c',
  ahead: '#0ca30c',
  on_pace: '#0ca30c',
  behind: '#fab219',
  far_behind: '#d03b3b',
}

export function paceLabel(daysAhead: number | null | undefined, finished = false): string {
  const tone = paceTone(daysAhead, finished)
  const days = Math.abs(daysAhead ?? 0)
  switch (tone) {
    case 'finished':
      return I18n.t('Finished')
    case 'ahead':
      return I18n.t({one: '1 day ahead', other: '%{count} days ahead'}, {count: days})
    case 'on_pace':
      return I18n.t('On pace')
    case 'behind':
    case 'far_behind':
      return I18n.t({one: '1 day behind', other: '%{count} days behind'}, {count: days})
    default:
      return I18n.t('No plan yet')
  }
}

// A YYYY-MM-DD date as a local calendar date (not midnight UTC, which shows as
// the day before west of Greenwich).
export function parsePlanDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatPlanDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = {weekday: 'short', month: 'short', day: 'numeric'},
): string {
  return parsePlanDate(iso).toLocaleDateString(undefined, options)
}

export function dayNumber(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return I18n.t('%{count} min', {count: Math.round(minutes)})
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return rest === 0
    ? I18n.t('%{hours} h', {hours})
    : I18n.t('%{hours} h %{minutes} min', {hours, minutes: rest})
}

// The value of a series on a given day: the last point on or before it.
export function valueOn(series: ChartPoint[], iso: string): number | null {
  const day = dayNumber(iso)
  let value: number | null = null
  for (const [date, percent] of series) {
    if (dayNumber(date) > day) break
    value = percent
  }
  return value
}
