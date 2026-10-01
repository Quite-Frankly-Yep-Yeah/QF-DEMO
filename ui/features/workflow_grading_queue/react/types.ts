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

export type QueueRow = {
  id: string
  tier: 1 | 2 | 3 | 4
  reason: string
  student: {id: string | null; name: string}
  course: {id: string; name: string}
  unit: {id: string; name: string} | null
  item: {id: string; title: string}
  submitted_at: string | null
  due_at: string | null
  speed_grader_url: string
}

export type QueueResult = {
  rows: QueueRow[]
  page: number
  per_page: number
  total: number
  truncated: boolean
  tier_counts: Record<string, number>
  turnaround: Record<string, {median_hours: number; graded_count: number}>
}

export type QueueConfig = {
  queue_url: string
}
