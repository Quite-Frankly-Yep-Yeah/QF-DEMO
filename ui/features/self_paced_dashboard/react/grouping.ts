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

import type {RosterRow, StudentRef, Status} from './types'

// The roster API returns one row per student and course. The dashboard shows
// one entry per student, with their classes underneath.
export type StudentGroup = {
  student: StudentRef
  rows: RosterRow[] // one per class, by course name
  primary: RosterRow // the class they're in now, or were in last
  summary: RosterRow // the classes rolled up, for the collapsed row and sorting
}

const STATUS_RANK: Record<Status, number> = {working: 0, idle: 1, away: 2}

function time(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0
}

function byWhereTheyAre(a: RosterRow, b: RosterRow): number {
  const rank = (row: RosterRow) => (row.status ? STATUS_RANK[row.status] : 3)
  return rank(a) - rank(b) || time(b.last_active_at) - time(a.last_active_at)
}

function summarize(rows: RosterRow[], primary: RosterRow): RosterRow {
  if (rows.length === 1) return rows[0]
  const sum = (pick: (row: RosterRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0)
  const paced = rows.map(row => row.days_behind).filter((days): days is number => days !== null)
  const lastActive = rows.map(row => row.last_active_at).filter(Boolean) as string[]
  return {
    ...primary,
    pinned: rows.some(row => row.pinned),
    percent_complete: sum(row => row.percent_complete) / rows.length,
    requirements_completed: sum(row => row.requirements_completed),
    requirements_total: sum(row => row.requirements_total),
    score: null, // grades aren't comparable across classes
    last_active_at: lastActive.sort((a, b) => time(b) - time(a))[0] ?? null,
    seconds_today: sum(row => row.seconds_today),
    seconds_this_week: sum(row => row.seconds_this_week),
    attempts_on_current_item: Math.max(...rows.map(row => row.attempts_on_current_item)),
    days_behind: paced.length > 0 ? Math.max(...paced) : null, // the class they're furthest behind in
  }
}

export function groupByStudent(rows: RosterRow[]): StudentGroup[] {
  const byStudent = new Map<string, RosterRow[]>()
  rows.forEach(row => {
    const list = byStudent.get(row.student.id) ?? []
    list.push(row)
    byStudent.set(row.student.id, list)
  })
  return Array.from(byStudent.values()).map(list => {
    const sorted = [...list].sort((a, b) => a.course.name.localeCompare(b.course.name))
    const primary = [...list].sort(byWhereTheyAre)[0]
    return {student: primary.student, rows: sorted, primary, summary: summarize(sorted, primary)}
  })
}
