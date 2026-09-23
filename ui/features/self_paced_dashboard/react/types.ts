/*
 * Copyright (C) 2026 - present EXAMPLE contributors
 *
 * This file is part of EXAMPLE LMS, a modified version of Canvas.
 *
 * EXAMPLE LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

export type Status = 'working' | 'idle' | 'away'

export type Item = {id: string; title: string; type: string}

export type StudentRef = {id: string; name: string; sortable_name: string}
export type CourseRef = {id: string; name: string; course_code: string}

// One row of GET /api/v1/self_paced/roster (SelfPaced::Roster#rows)
export type RosterRow = {
  student: StudentRef
  course: CourseRef
  pinned: boolean
  status: Status | null // null when the viewer can't see live status
  viewing: Item | null
  viewing_since: string | null
  current_item: Item | null
  attempts_on_current_item: number
  percent_complete: number
  requirements_completed: number
  requirements_total: number
  score: number | null // null when grades are hidden from the viewer
  last_active_at: string | null
  seconds_today: number
  seconds_this_week: number
}

export type DashboardConfig = {
  roster_url: string
  student_url: string // template with :course_id and :student_id
  caseload_url: string // template with :student_id
  course_id: string | null
  idle_minutes: number
  poll_seconds: number
}

export type ActivityDay = {day: string; active_seconds: number; submissions: number}

export type DetailItem = {
  id: string
  title: string
  type: string
  module: string
  active_seconds: number
  last_viewed_at: string | null
  completed: boolean
}

export type Attempt = {
  attempt: number
  submitted_at: string | null
  score: number | null
  workflow_state: string
}

export type AssignmentAttempts = {
  assignment_id: string
  title: string
  points_possible: number | null
  attempts: Attempt[]
}

export type TimelineEvent =
  | {kind: 'viewed'; title: string; at: string; active_seconds: number}
  | {
      kind: 'submitted'
      title: string
      at: string
      attempt: number
      score: number | null
      points_possible: number | null
    }

// GET /api/v1/self_paced/courses/:course_id/students/:student_id (SelfPaced::StudentDetail)
export type StudentDetail = {
  student: StudentRef
  course: CourseRef
  status: Status | null
  percent_complete: number
  requirements_completed: number
  requirements_total: number
  current_item_id: string | null
  grades_visible: boolean
  activity: ActivityDay[]
  items: DetailItem[]
  attempts: AssignmentAttempts[]
  timeline: TimelineEvent[]
}

export type RowKey = {courseId: string; studentId: string}
