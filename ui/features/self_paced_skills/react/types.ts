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

export type Level = 'mastered' | 'almost' | 'building' | 'not_assessed'

export type SkillsConfig = {
  course: {id: string; name: string; color: string | null}
  skills_url: string
  can_add: boolean
  classic_url: string
  home_url: string
}

export type StudentLevel = {
  id: string
  name: string
  level: Level
  score: number | null
  assessed_at: string | null
}

export type Skill = {
  id: string
  title: string
  description: string | null
  mastery_points: number | null
  counts: Record<Level, number>
  aligned: {id: string; title: string; type: string; url: string | null}[]
  // lessons a student skips once they master the skill (test-out), and how many have
  lessons: {id: string; title: string}[]
  tested_out: number
  students: StudentLevel[]
}

// GET /api/v1/courses/:id/self_paced/skills (SelfPaced::Skills#as_json)
export type SkillsData = {
  course: {id: string; name: string}
  students: number
  skills: Skill[]
  summary: {
    totals: Record<Level, number>
    mastered_percent: number | null
    needing_attention: number
  }
}
