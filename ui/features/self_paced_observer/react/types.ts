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

export type ObserverConfig = {data_url: string; classic_url: string}

export type CourseProgress = {
  id: string
  name: string
  course_code: string
  color: string | null
  percent_complete: number
  requirements_completed: number
  requirements_total: number
  last_active_at: string | null
  // days behind the plan (negative when ahead); null when the course isn't paced
  pace: {days_behind: number; target_date: string | null; expected_percent: number | null} | null
}

export type Grade = {
  id: string
  title: string
  course: string
  score: number
  points_possible: number | null
  graded_at: string
}

export type ObserverAlert = {
  id: string
  kind: 'behind' | 'inactive'
  description: string
  course: string
  opened_at: string
}

export type ObservedStudent = {
  id: string
  name: string
  short_name: string
  courses: CourseProgress[]
  time: {
    daily: {day: string; minutes: number}[]
    week_minutes: number
    previous_week_minutes: number
  }
  grades: Grade[]
  alerts: ObserverAlert[]
}

// GET /api/v1/self_paced/observer (SelfPaced::ObserverView#as_json)
export type ObserverData = {
  observer: {id: string; name: string}
  students: ObservedStudent[]
}
