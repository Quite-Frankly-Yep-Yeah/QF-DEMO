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

import type {Pacing} from '../pacing'

// Monday 2026-10-05 to Friday 2026-10-09, four lessons; it's Wednesday and
// the student has done the first two.
export function pacingFixture(overrides: Partial<Pacing> = {}): Pacing {
  return {
    start_date: '2026-10-05',
    target_date: '2026-10-09',
    target_source: 'default',
    days_ahead: 1,
    expected_percent: 40,
    percent_complete: 50,
    finished: false,
    daily_minutes: 24,
    today: {total: 1, done: 0, minutes: 30, item_ids: ['3']},
    week: {total: 3, done: 1, minutes: 90},
    items: [
      {
        id: '2',
        title: 'Lesson 2',
        type: 'WikiPage',
        url: '/courses/1/modules/items/2',
        planned_date: '2026-10-06',
        completed: true,
      },
      {
        id: '3',
        title: 'Lesson 3',
        type: 'WikiPage',
        url: '/courses/1/modules/items/3',
        planned_date: '2026-10-07',
        completed: false,
      },
      {
        id: '4',
        title: 'Lesson 4',
        type: 'WikiPage',
        url: '/courses/1/modules/items/4',
        planned_date: '2026-10-09',
        completed: false,
      },
    ],
    chart: {
      baseline: [
        ['2026-10-05', 20],
        ['2026-10-06', 40],
        ['2026-10-07', 60],
        ['2026-10-08', 80],
        ['2026-10-09', 100],
      ],
      actual: [
        ['2026-10-05', 25],
        ['2026-10-06', 50],
      ],
      projected: [
        ['2026-10-07', 67],
        ['2026-10-08', 83],
        ['2026-10-09', 100],
      ],
      today: '2026-10-07',
      total_minutes: 120,
    },
    can_adjust: false,
    ...overrides,
  }
}
