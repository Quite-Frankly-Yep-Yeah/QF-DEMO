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

export type Link = {id: string; label: string; url: string}

export type Step = {id: string; label: string; done: boolean; url: string}

export type Unit = {
  id: string
  name: string
  published: boolean
  items: number
  quizzes: number
  unpublished_items: number
  url: string
}

export type Stats = {
  students: number
  tracked: number
  average_percent: number
  behind: number
  stuck: number
  inactive: number
}

// ENV.SELF_PACED_COURSE_HOME (SelfPaced::StaffHome#as_json)
export type CourseHomeConfig = {
  course: {
    id: string
    name: string
    course_code: string
    published: boolean
    color: string | null
  }
  checklist: Step[]
  units: Unit[]
  stats: Stats | null
  links: {make: Link[]; manage: Link[]; class: Link[]}
  classic_url: string
}
