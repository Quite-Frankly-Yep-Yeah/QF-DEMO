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

import ready from '@instructure/ready'
import {formatRegion, parseRegions, regionFromDrag} from '@canvas/sylla-regions'

// The quiz editor's hotspot helper: shows the image under "Image address" and
// lets the teacher drag rectangles on it, each becoming a line in "Regions".

function parts(holder: HTMLElement) {
  return {
    image: holder.querySelector<HTMLInputElement>('.sylla_image_input'),
    regions: holder.querySelector<HTMLTextAreaElement>('.sylla_regions_input'),
    preview: holder.querySelector<HTMLElement>('.sylla_region_preview'),
  }
}

function draw(holder: HTMLElement) {
  const {image, regions, preview} = parts(holder)
  if (!image || !regions || !preview) return
  const src = image.value.trim()
  const shown = preview.querySelector('img')
  if (!/^(https?:\/\/|\/)\S+$/.test(src)) {
    preview.replaceChildren()
    return
  }
  if (!shown || shown.getAttribute('src') !== src) {
    const img = document.createElement('img')
    img.src = src
    img.alt = ''
    img.draggable = false
    preview.replaceChildren(img)
  }
  preview.querySelectorAll('.sylla_region_box').forEach(box => box.remove())
  parseRegions(regions.value).forEach(region => {
    const box = document.createElement('div')
    box.className = 'sylla_region_box'
    box.style.cssText = `left: ${region.x}%; top: ${region.y}%; width: ${region.width}%; height: ${region.height}%;`
    box.textContent = region.label
    preview.append(box)
  })
}

function watch(holder: HTMLElement) {
  // the template form is cloned for each edit, and clones must start unwatched
  if (holder.dataset.syllaRegionEditor || holder.closest('#question_form_template')) return
  holder.dataset.syllaRegionEditor = 'true'
  const {image, regions, preview} = parts(holder)
  image?.addEventListener('input', () => draw(holder))
  regions?.addEventListener('input', () => draw(holder))

  let start: {x: number; y: number} | null = null
  const point = (event: MouseEvent) => {
    const box = preview!.querySelector('img')!.getBoundingClientRect()
    return {x: event.clientX - box.left, y: event.clientY - box.top}
  }
  preview?.addEventListener('mousedown', event => {
    if (!preview.querySelector('img')) return
    event.preventDefault()
    start = point(event)
  })
  preview?.addEventListener('mouseup', event => {
    const img = preview.querySelector('img')
    if (!start || !img || !regions) return
    const box = img.getBoundingClientRect()
    const region = regionFromDrag(start, point(event), {width: box.width, height: box.height})
    start = null
    if (!region) return
    regions.value = [regions.value.trim(), formatRegion(region)].filter(Boolean).join('\n')
    regions.dispatchEvent(new Event('input', {bubbles: true}))
    regions.dispatchEvent(new Event('change', {bubbles: true}))
  })
  draw(holder)
}

function scan(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('.sylla_hotspot_holder').forEach(watch)
}

ready(() => {
  scan(document)
  // editing forms are cloned and inserted as the teacher works
  new MutationObserver(() => scan(document)).observe(document.body, {
    childList: true,
    subtree: true,
  })
})
