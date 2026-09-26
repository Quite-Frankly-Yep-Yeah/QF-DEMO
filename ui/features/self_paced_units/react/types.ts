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

export type Role = 'instruction' | 'practice' | 'check' | 'pretest' | 'none'

export type UnitsConfig = {
  course: {id: string; name: string; color: string | null}
  setup_url: string
  classic_url: string
  home_url: string
}

// One item of GET /api/v1/courses/:id/self_paced/setup (SelfPaced::CourseSetup)
export type Item = {
  id: string
  title: string
  type: string
  published: boolean
  url: string
  role: Role
  estimated_minutes: number | null
  suggested_minutes?: number | null
  mastery_threshold: number | null
  watch_fraction: number | null
  max_attempts: number | null
  retake_review: boolean
  skill_id: string | null // the skill it teaches; mastering it skips the item
}

export type Unit = {id: string; name: string; published: boolean; items: Item[]}

export type Setup = {
  mastery_threshold: number
  provisional_checks: boolean
  skills: {id: string; title: string}[]
  modules: Unit[]
}

// What can be added to a unit
export type NewItem =
  | {kind: 'new_page' | 'new_quiz' | 'new_assignment' | 'header'; title: string}
  | {kind: 'page' | 'quiz' | 'assignment'; id: string; title: string}
