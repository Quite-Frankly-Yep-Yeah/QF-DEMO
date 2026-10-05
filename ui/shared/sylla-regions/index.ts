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

// A hotspot's regions, one per line: "Choice text | left | top | width | height",
// each number a percent of the image (question_data.sylla_regions).

export type Region = {label: string; x: number; y: number; width: number; height: number}

const clamp = (value: number) => Math.min(100, Math.max(0, value))
const round = (value: number) => Math.round(value * 10) / 10

export function parseRegions(source: string): Region[] {
  return source
    .split('\n')
    .map(line => line.split('|').map(part => part.trim()))
    .filter(parts => parts.length === 5 && parts[0] !== '')
    .map(([label, x, y, width, height]) => ({
      label,
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height),
    }))
    .filter(region =>
      [region.x, region.y, region.width, region.height].every(n => Number.isFinite(n)),
    )
    .filter(region => region.width > 0 && region.height > 0)
}

export function formatRegion(region: Region): string {
  return [region.label, region.x, region.y, region.width, region.height].join(' | ')
}

// The last region containing the point wins, so a small region drawn over a
// large one can be picked.
export function regionAt(regions: Region[], x: number, y: number): Region | undefined {
  return [...regions]
    .reverse()
    .find(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height)
}

// A drag from one corner to another over an image, as a region in percent.
// Points are in the image's own pixels; the size is the image's on-screen size.
export function regionFromDrag(
  start: {x: number; y: number},
  end: {x: number; y: number},
  size: {width: number; height: number},
  label = 'Choice',
): Region | null {
  if (size.width <= 0 || size.height <= 0) return null
  const left = clamp((Math.min(start.x, end.x) / size.width) * 100)
  const top = clamp((Math.min(start.y, end.y) / size.height) * 100)
  const right = clamp((Math.max(start.x, end.x) / size.width) * 100)
  const bottom = clamp((Math.max(start.y, end.y) / size.height) * 100)
  const width = right - left
  const height = bottom - top
  // a click or a tiny wobble isn't a region
  if (width < 1 || height < 1) return null
  return {label, x: round(left), y: round(top), width: round(width), height: round(height)}
}
