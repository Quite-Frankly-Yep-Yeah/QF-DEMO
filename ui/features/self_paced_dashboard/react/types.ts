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
  days_behind: number | null // null when the course isn't paced
  target_date: string | null
  expected_percent: number | null
}

export type DashboardConfig = {
  roster_url: string
  student_url: string // template with :course_id and :student_id
  caseload_url: string // template with :student_id
  pacing_url: string // template with :course_id and :student_id
  student_pacing_url: string // template with :course_id and :student_id
  course_id: string | null
  idle_minutes: number
  poll_seconds: number
  // only when interventions are on in at least one of the viewer's courses
  interventions_url?: string | null // template with :course_id and :student_id
  bulk_interventions_url?: string | null
  course_ids?: string[] // every course on the dashboard, for stable colors
  // courses with their own page (Phase 5b), and its address
  course_page_url?: string // template with :course_id
  course_page_ids?: string[]
  dashboard_url?: string
}

export type Link = {label: string; url: string}

// ENV.SELF_PACED_COURSE, on the page for one course
export type CourseConfig = {
  course: CourseRef
  summary_url: string
  dashboard_url: string // the Students page, filtered to this course
  edit_links: Link[] | null // null for staff who can't edit the course
  // Phase 6: only when alerts are on for this course
  alerts_url?: string
  alert_rules_url?: string
  can_edit_alert_rules?: boolean
  // Phase 7: CSV downloads, only when reports are on for this course
  report_links?: Link[]
}

export type ChartPoint = [string, number]

// GET /api/v1/self_paced/courses/:course_id/summary (SelfPaced::CourseSummary)
export type CourseSummary = {
  course: CourseRef
  units: {
    id: string
    name: string
    item_ids: string[]
    students_here: number
    stuck_here: number
    completed: number
  }[]
  hard_items: {
    id: string
    title: string
    module: string
    students_tried: number
    average_tries: number
    needed_many_tries: number
    students_on_it: number
  }[]
  items: {
    id: string
    title: string
    module: string
    graded: boolean
    attempts_limited: boolean
  }[]
  chart: {
    baseline: ChartPoint[]
    actual: ChartPoint[]
    projected: ChartPoint[]
    today: string
    total_minutes: number
  } | null
  tools: Tools
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
  // only when interventions are on for the course
  overrides?: OverrideKind[]
  graded?: boolean
  attempts_limited?: boolean
}

export type OverrideKind = 'unlock' | 'exempt' | 'complete'

export type InterventionKind =
  | 'unlock'
  | 'extra_attempts'
  | 'reset_attempt'
  | 'exempt'
  | 'mark_complete'
  | 'undo'
  | 'adjust_target'
  | 'note'
  | 'delete_note'
  | 'message'

// What the viewer may do in a course (SelfPaced::Intervener#tools)
export type Tools = {
  unlock: boolean
  mark_complete: boolean
  exempt: boolean
  exempt_graded: boolean
  extra_attempts: boolean
  reset_attempt: boolean
  adjust_target: boolean
  note: boolean
  message: boolean
}

export type Person = {id: string; name: string}

// One row of the intervention log (SelfPaced::Intervention#as_json_for_log)
export type LogEntry = {
  id: string
  kind: InterventionKind
  created_at: string
  actor: Person
  real_actor: Person | null
  item: {id: string; title: string} | null
  reason: string | null
  payload: Record<string, unknown>
  bulk: boolean
}

export type Note = {
  id: string
  body: string
  created_at: string
  author: Person
  course: {id: string; name: string} | null
  can_delete: boolean
}

// GET /api/v1/self_paced/courses/:course_id/students/:student_id/interventions
export type Support = {tools: Tools; log: LogEntry[]; notes: Note[]}

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
