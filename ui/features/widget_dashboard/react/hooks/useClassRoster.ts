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

import {useQuery} from '@tanstack/react-query'
import doFetchApi from '@canvas/do-fetch-api-effect'

// One row of GET /api/v1/self_paced/roster: a student in one of the viewer's classes.
export type ClassRow = {
  student: {id: string; name: string}
  course: {id: string; name: string}
  percent_complete: number
  attempts_on_current_item: number
  days_behind: number | null
  last_active_at: string | null
}

export const STUCK_TRIES = 3
export const BEHIND_DAYS = 3
export const INACTIVE_DAYS = 3

export type Reason = 'stuck' | 'behind' | 'inactive'

export function reasonsFor(row: ClassRow, now: Date = new Date()): Reason[] {
  const reasons: Reason[] = []
  if (row.attempts_on_current_item >= STUCK_TRIES) reasons.push('stuck')
  if ((row.days_behind ?? 0) >= BEHIND_DAYS) reasons.push('behind')
  const last = row.last_active_at ? new Date(row.last_active_at).getTime() : null
  if (last === null || now.getTime() - last > INACTIVE_DAYS * 86_400_000) reasons.push('inactive')
  return reasons
}

// The viewer's students, from the self-paced dashboard's roster.
export function useClassRoster() {
  return useQuery({
    queryKey: ['educatorClassRoster'],
    queryFn: async () => {
      const {json} = await doFetchApi<{rows: ClassRow[]}>({path: '/api/v1/self_paced/roster'})
      return json?.rows ?? []
    },
    refetchInterval: 60_000,
  })
}
