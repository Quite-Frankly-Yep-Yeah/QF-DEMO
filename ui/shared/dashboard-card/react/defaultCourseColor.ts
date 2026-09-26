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

// Courses get their accent colour from their course image (see
// AccentColorExtractor on the Ruby side). A course with no image yet has
// no server-picked colour to show, so this picks a stable one instead of
// a plain gray -- same asset string always gives the same colour, so it
// doesn't shift between page loads.
const DEFAULT_COLOR_OPTIONS = [
  '#008400',
  '#91349B',
  '#E1185C',
  '#D41E00',
  '#0076B8',
  '#626E7B',
  '#4D3D4D',
  '#254284',
  '#986C16',
  '#177B63',
  '#324A4D',
  '#3C4F36',
]

export default function defaultCourseColor(assetString: string): string {
  let hash = 0
  for (let i = 0; i < assetString.length; i++) {
    hash = (hash * 31 + assetString.charCodeAt(i)) | 0
  }
  return DEFAULT_COLOR_OPTIONS[Math.abs(hash) % DEFAULT_COLOR_OPTIONS.length]
}
