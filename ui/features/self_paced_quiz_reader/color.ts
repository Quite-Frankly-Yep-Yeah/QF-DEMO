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

type Rgb = [number, number, number]

export type AccentVars = {
  accent: string // the course color, for borders and fills
  strong: string // darkened until white text on it reaches 4.5:1
  rgb: string // "r, g, b" of the course color, for translucent tints
}

function parseHex(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = match[1].length === 3 ? match[1].replace(/./g, c => c + c) : match[1]
  return [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16)) as Rgb
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const toHex = (rgb: Rgb) => `#${rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`

// The course color and a darker shade of it that white text can sit on. Null
// when the color isn't a hex value, so callers keep the stylesheet's defaults.
export function accentVars(color: string | null | undefined): AccentVars | null {
  const base = color ? parseHex(color) : null
  if (!base) return null
  let strong = base
  for (let mix = 0; mix <= 0.8 && 1.05 / (luminance(strong) + 0.05) < 4.5; mix += 0.04) {
    strong = base.map(c => c * (1 - mix)) as Rgb
  }
  return {accent: toHex(base), strong: toHex(strong), rgb: base.join(', ')}
}
