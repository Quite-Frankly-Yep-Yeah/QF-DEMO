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

import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('self_paced_player')

// Shapes of GET /api/v1/courses/:course_id/self_paced/map (SelfPaced::PlayerMap)

export type PlayerItemStatus = 'completed' | 'current' | 'available' | 'locked'

export type PlayerItem = {
  id: string
  title: string
  type: string // 'header' for lesson sub-headers
  url?: string
  role?: 'instruction' | 'practice' | 'check' | 'pretest' | 'none'
  estimated_minutes?: number | null
  requirement?: {type: string; min_percentage?: number; min_score?: number} | null
  status?: PlayerItemStatus
  tested_out?: boolean // skipped because the student mastered the skill it teaches
}

export type PlayerUnit = {id: string; name: string; state: string; items: PlayerItem[]}

export type PlayerMap = {
  course: {id: string; name: string}
  percent_complete: number
  requirements_completed: number
  requirements_total: number
  current_item: {id: string; title: string; url: string} | null
  units: PlayerUnit[]
}

// The accent when the student hasn't picked a color for the course.
export const DEFAULT_COURSE_COLOR = '#2a78d6'

// Every item a student can step through, in order (lesson headers left out).
export function steps(map: PlayerMap): PlayerItem[] {
  return map.units.flatMap(unit => unit.items.filter(item => item.type !== 'header'))
}

export type Neighbours = {
  previous: PlayerItem | null
  next: PlayerItem | null
  position: number // 1-based, 0 when the item isn't in the course
  total: number
  unit: PlayerUnit | null
}

export function neighbours(map: PlayerMap, itemId: string | null | undefined): Neighbours {
  const all = steps(map)
  const index = itemId ? all.findIndex(item => item.id === itemId) : -1
  const unit = index >= 0 ? map.units.find(u => u.items.some(i => i.id === itemId)) || null : null
  return {
    previous: index > 0 ? all[index - 1] : null,
    next: index >= 0 && index < all.length - 1 ? all[index + 1] : null,
    position: index + 1,
    total: all.length,
    unit,
  }
}

export function roleLabel(role: PlayerItem['role']): string | null {
  switch (role) {
    case 'instruction':
      return I18n.t('Lesson')
    case 'practice':
      return I18n.t('Practice')
    case 'check':
      return I18n.t('Check')
    case 'pretest':
      return I18n.t('Pretest')
    default:
      return null
  }
}

export function tint(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map(c => c + c)
          .join('')
      : value
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
