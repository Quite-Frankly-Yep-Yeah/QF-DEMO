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

import {tokenVar} from '@canvas/material/themes'
import type {Status} from './types'

// Course identity colors: the validated categorical order from the dataviz
// reference palette (every adjacent pair clears the colorblind separation
// target). A course keeps its color everywhere on the page - chips, progress,
// avatar rings, charts. Course names always sit next to the color, so identity
// never rests on color alone, even past eight courses where colors repeat.
export const COURSE_PALETTE = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
]

// Reserved for state, never for a course; always shown with a shape and a word.
export const STATUS_COLORS: Record<Status | 'stuck', string> = {
  working: '#0ca30c',
  idle: '#fab219',
  away: '#898781',
  stuck: '#d03b3b',
}

// Themed: these follow the active theme (see @canvas/material).
export const INK = {
  primary: tokenVar('ink'),
  secondary: tokenVar('inkSecondary'),
  muted: tokenVar('inkSecondary'),
  hairline: tokenVar('divider'),
}

// Color per course id. The viewer's own quite frankly an example LMS course colors win (the ones they
// picked on their quite frankly an example LMS dashboard); other courses take palette slots in course
// id order, so a course's color doesn't change when filters change.
export function courseColors(
  courseIds: string[],
  customColors: Record<string, string> = {},
): Record<string, string> {
  const sorted = Array.from(new Set(courseIds)).sort((a, b) => Number(a) - Number(b))
  const colors: Record<string, string> = {}
  sorted.forEach((id, index) => {
    colors[id] = customColors[`course_${id}`] || COURSE_PALETTE[index % COURSE_PALETTE.length]
  })
  return colors
}

// A pale wash of a color, for tracks and avatar backgrounds.
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
