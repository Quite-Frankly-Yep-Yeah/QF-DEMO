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

import type {RosterRow, StudentDetail} from '../types'

export const NOW = new Date('2026-09-22T15:00:00Z')

const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString()

export function rosterRow(overrides: Partial<RosterRow> & {name: string; id: string}): RosterRow {
  const {name, id, ...rest} = overrides
  const [first, ...last] = name.split(' ')
  return {
    student: {id, name, sortable_name: `${last.join(' ')}, ${first}`},
    course: {id: '4', name: 'Algebra 1', course_code: 'ALG1'},
    pinned: false,
    status: 'working',
    viewing: {id: '101', title: '1.1 Classwork', type: 'Quizzes::Quiz'},
    viewing_since: minutesAgo(12),
    current_item: {id: '101', title: '1.1 Classwork', type: 'Quizzes::Quiz'},
    attempts_on_current_item: 0,
    percent_complete: 40,
    requirements_completed: 4,
    requirements_total: 10,
    score: 82.5,
    last_active_at: minutesAgo(1),
    seconds_today: 1800,
    seconds_this_week: 7200,
    days_behind: 0,
    target_date: '2027-06-04',
    expected_percent: 40,
    ...rest,
  }
}

export const ROWS: RosterRow[] = [
  rosterRow({id: '1', name: 'Maya Lopez', status: 'working', percent_complete: 40}),
  rosterRow({
    id: '2',
    name: 'Jordan Kim',
    status: 'idle',
    percent_complete: 75,
    attempts_on_current_item: 4,
    last_active_at: minutesAgo(9),
  }),
  rosterRow({
    id: '3',
    name: 'Sam Rivera',
    status: 'away',
    percent_complete: 10,
    viewing: null,
    last_active_at: minutesAgo(60 * 26),
    course: {id: '7', name: 'Biology', course_code: 'BIO'},
    score: null,
  }),
]

export const DETAIL: StudentDetail = {
  student: {id: '1', name: 'Maya Lopez', sortable_name: 'Lopez, Maya'},
  course: {id: '4', name: 'Algebra 1', course_code: 'ALG1'},
  status: 'working',
  percent_complete: 40,
  requirements_completed: 4,
  requirements_total: 10,
  current_item_id: '101',
  grades_visible: true,
  activity: Array.from({length: 28}, (_, i) => ({
    day: new Date(Date.UTC(2026, 7, 26 + i)).toISOString().slice(0, 10),
    active_seconds: i % 3 === 0 ? 0 : 1200 + i * 30,
    submissions: i % 5 === 0 ? 1 : 0,
  })),
  items: [
    {
      id: '100',
      title: '1.1 Lesson',
      type: 'WikiPage',
      module: 'Unit 1',
      active_seconds: 600,
      last_viewed_at: null,
      completed: true,
    },
    {
      id: '101',
      title: '1.1 Classwork',
      type: 'Quizzes::Quiz',
      module: 'Unit 1',
      active_seconds: 900,
      last_viewed_at: null,
      completed: false,
    },
  ],
  attempts: [
    {
      assignment_id: '55',
      title: '1.1 Classwork',
      points_possible: 10,
      attempts: [
        {attempt: 1, submitted_at: '2026-09-21T14:00:00Z', score: 5, workflow_state: 'graded'},
        {attempt: 2, submitted_at: '2026-09-22T14:30:00Z', score: 6, workflow_state: 'graded'},
      ],
    },
  ],
  timeline: [
    {
      kind: 'submitted',
      title: '1.1 Classwork',
      at: '2026-09-22T14:30:00Z',
      attempt: 2,
      score: 6,
      points_possible: 10,
    },
  ],
}
