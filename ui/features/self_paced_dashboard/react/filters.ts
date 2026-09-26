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
import {FAR_BEHIND_DAYS} from '@canvas/self-paced/pacing'
import {isStuck} from './format'
import {groupByStudent} from './grouping'
import type {RosterRow} from './types'

const I18n = createI18nScope('self_paced_dashboard')

// Quick filters for finding who needs help in a big roster. Each works on a
// student (all their classes together), so a student stuck in one class
// shows up under "Stuck" with every class they take.
export type QuickFilter = 'all' | 'working' | 'stuck' | 'behind' | 'inactive'

export const QUICK_FILTERS: QuickFilter[] = ['all', 'working', 'stuck', 'behind', 'inactive']

// No activity for this long counts as inactive.
export const INACTIVE_DAYS = 3

export function quickFilterLabel(filter: QuickFilter): string {
  switch (filter) {
    case 'all':
      return I18n.t('All')
    case 'working':
      return I18n.t('Working now')
    case 'stuck':
      return I18n.t('Stuck')
    case 'behind':
      return I18n.t('Behind pace')
    case 'inactive':
      return I18n.t('Inactive %{days}+ days', {days: INACTIVE_DAYS})
  }
}

function studentMatches(rows: RosterRow[], filter: QuickFilter, now: Date): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'working':
      return rows.some(row => row.status === 'working')
    case 'stuck':
      return rows.some(isStuck)
    case 'behind':
      return rows.some(row => row.days_behind !== null && row.days_behind >= FAR_BEHIND_DAYS)
    case 'inactive': {
      const cutoff = now.getTime() - INACTIVE_DAYS * 86_400_000
      return rows.every(
        row => !row.last_active_at || new Date(row.last_active_at).getTime() < cutoff,
      )
    }
  }
}

// Case and accent insensitive, so "jose" finds "José".
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// Every word of the search has to appear in the student's name.
export function matchesSearch(row: RosterRow, search: string): boolean {
  const words = normalize(search).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const name = normalize(`${row.student.name} ${row.student.sortable_name}`)
  return words.every(word => name.includes(word))
}

// The rows for the students that pass the search and the quick filter.
export function applyFilters(
  rows: RosterRow[],
  {search, quick, now}: {search: string; quick: QuickFilter; now: Date},
): RosterRow[] {
  const keep = new Set(
    groupByStudent(rows)
      .filter(
        group => matchesSearch(group.primary, search) && studentMatches(group.rows, quick, now),
      )
      .map(group => group.student.id),
  )
  return rows.filter(row => keep.has(row.student.id))
}

// How many students each quick filter would show, for the chip counts.
export function quickFilterCounts(rows: RosterRow[], now: Date): Record<QuickFilter, number> {
  const groups = groupByStudent(rows)
  return Object.fromEntries(
    QUICK_FILTERS.map(filter => [
      filter,
      groups.filter(group => studentMatches(group.rows, filter, now)).length,
    ]),
  ) as Record<QuickFilter, number>
}

// The page's filters live in the address bar, so a reload or a shared link
// opens the same view.
export type ViewState = {
  tab: 'roster' | 'live'
  search: string
  quick: QuickFilter
  course: string | null
}

export function readViewState(search: string): Partial<ViewState> {
  const params = new URLSearchParams(search)
  const state: Partial<ViewState> = {}
  const tab = params.get('view')
  if (tab === 'roster' || tab === 'live') state.tab = tab
  const quick = params.get('show') as QuickFilter | null
  if (quick && QUICK_FILTERS.includes(quick)) state.quick = quick
  if (params.get('q')) state.search = params.get('q') as string
  if (params.get('course_id')) state.course = params.get('course_id')
  return state
}

export function writeViewState(current: string, state: ViewState): string {
  const params = new URLSearchParams(current)
  const set = (key: string, value: string | null, fallback: string | null) => {
    if (value && value !== fallback) params.set(key, value)
    else params.delete(key)
  }
  set('view', state.tab, 'roster')
  set('show', state.quick, 'all')
  set('q', state.search.trim() || null, null)
  set('course_id', state.course, null)
  const query = params.toString()
  return query ? `?${query}` : ''
}
