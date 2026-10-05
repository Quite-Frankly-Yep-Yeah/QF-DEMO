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

export type HomeConfig = {home_url: string; classic_url: string}

export type HomeCourse = {
  id: string
  name: string
  course_code: string
  color: string | null // the course's own color, if it has one
  image_url: string | null
  url: string // the course map
  percent_complete: number
  requirements_completed: number
  requirements_total: number
  score: number | null // posted grade, percent
  last_active_at: string | null
  continue: {title: string; module: string | null; url: string} | null
  pace: {
    days_ahead: number
    finished: boolean
    target_date: string
    today: {done: number; total: number; minutes: number}
    week: {done: number; total: number}
  } | null
}

export type DueItem = {id: string; title: string; course_id: string; due_at: string; url: string}

export type FeedbackItem = {
  id: string
  title: string
  course_id: string
  score: number
  points_possible: number | null
  graded_at: string
  url: string
}

// GET /api/v1/self_paced/home (SelfPaced::StudentHome)
export type Home = {
  student: {id: string; name: string; short_name: string}
  courses: HomeCourse[]
  resume_course_id: string | null
  due_soon: DueItem[]
  feedback: FeedbackItem[]
  other_courses: {
    id: string
    name: string
    course_code: string
    url: string
    color: string | null
  }[]
}
