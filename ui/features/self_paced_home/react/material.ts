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

// The home page's Material 1 tokens, the same as the course map, the
// Students page and the dashboard: Roboto, the brand blue app bar, grey
// surface, paper shadows and a color for every class.

export const ROBOTO = "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"
export const APP_BAR = '#2B7ABC'
export const SURFACE = '#EEEEEE'
export const INK = {
  primary: 'rgba(0,0,0,0.87)',
  secondary: 'rgba(0,0,0,0.6)',
  muted: 'rgba(0,0,0,0.5)',
}

export const PALETTE = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
]

export const ELEVATION = {
  1: '0 1px 3px rgba(0,0,0,0.2), 0 1px 1px rgba(0,0,0,0.14), 0 2px 1px -1px rgba(0,0,0,0.12)',
  2: '0 1px 5px rgba(0,0,0,0.2), 0 2px 2px rgba(0,0,0,0.14), 0 3px 1px -2px rgba(0,0,0,0.12)',
  4: '0 2px 4px -1px rgba(0,0,0,0.2), 0 4px 5px rgba(0,0,0,0.14), 0 1px 10px rgba(0,0,0,0.12)',
  8: '0 5px 5px -3px rgba(0,0,0,0.2), 0 8px 10px 1px rgba(0,0,0,0.14), 0 3px 14px 2px rgba(0,0,0,0.12)',
}

function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4]
    .map(i => parseInt(value.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

// The color darkened just enough for white text on it, or for text in it on
// white (4.5:1).
export function ink(hex: string): string {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16))
  for (let factor = 1; factor > 0; factor -= 0.02) {
    const candidate = `#${channels
      .map(c =>
        Math.round(c * factor)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`
    if (contrast(candidate, '#ffffff') >= 4.5) return candidate
  }
  return '#000000'
}

export function tint(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const HEX = /^#[0-9a-f]{6}$/i

// A class's color: the student's own pick, then the course's color, then
// the palette in course order.
export function classColors(
  courses: {id: string; color: string | null}[],
  custom: Record<string, string>,
): Record<string, string> {
  const ids = courses.map(c => c.id).sort((a, b) => Number(a) - Number(b))
  const result: Record<string, string> = {}
  courses.forEach(course => {
    const own = custom[`course_${course.id}`]
    result[course.id] =
      (own && HEX.test(own) && own) ||
      (course.color && HEX.test(course.color) && course.color) ||
      PALETTE[ids.indexOf(course.id) % PALETTE.length]
  })
  return result
}
