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
import {enhanceConfidence, enhanceHotspot, enhanceUnit} from './extras'

const I18n = createI18nScope('sylla_question_layouts')

// A matching question with question_data.sylla_layout set is answered with
// the usual selects, so grading, statistics and export stay the standard
// matching ones. This draws a friendlier control over them:
//
// - ordering: the selects' options are the positions (1, 2, 3...); the student
//   puts the items in order with the arrow buttons.
// - categorize: the selects' options are the categories; the student picks an
//   item, then the category to put it in.
//
// The selects stay in the form (hidden) and are kept in sync, so nothing
// changes about what is submitted. A question that isn't set up for its layout
// (positions that aren't 1..N, fewer than two categories) keeps its selects.

type Item = {label: string; select: HTMLSelectElement}

const STYLE_ID = 'sylla-layouts-style'
const SHADOW = '0 1px 3px rgba(0,0,0,0.2), 0 1px 1px rgba(0,0,0,0.14)'
const STYLES = `
.sylla-layout { margin: 8px 0 16px; font-family: inherit; }
.sylla-layout ol, .sylla-layout ul { list-style: none; margin: 0; padding: 0; }
.sylla-layout button { font: inherit; cursor: pointer; }
.sylla-order li { display: flex; align-items: center; gap: 12px; margin: 0 0 8px; padding: 8px 12px; background: #fff; border-radius: 2px; box-shadow: ${SHADOW}; }
.sylla-order .sylla-pos { width: 1.5rem; font-size: 1.25rem; font-weight: 300; color: #616161; }
.sylla-order .sylla-text { flex: 1; overflow-wrap: anywhere; }
.sylla-order button { border: 1px solid rgba(0,0,0,0.24); background: #fff; border-radius: 2px; padding: 4px 10px; }
.sylla-order button:disabled { opacity: 0.4; cursor: default; }
.sylla-buckets { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 12px; }
.sylla-bucket { background: #fff; border-radius: 2px; box-shadow: ${SHADOW}; padding: 12px; }
.sylla-bucket h4 { margin: 0 0 8px; font-size: 1rem; font-weight: 500; }
.sylla-bucket .sylla-place { width: 100%; margin-top: 8px; border: 1px dashed rgba(0,0,0,0.4); background: transparent; border-radius: 2px; padding: 6px; }
.sylla-bucket .sylla-place:disabled { opacity: 0.4; cursor: default; }
.sylla-chip { display: block; width: 100%; text-align: left; margin: 0 0 6px; padding: 6px 10px; border: 1px solid rgba(0,0,0,0.24); background: #fff; border-radius: 2px; overflow-wrap: anywhere; }
.sylla-chip[aria-pressed="true"] { border-color: var(--ic-brand-primary, #2b7abc); box-shadow: inset 0 0 0 2px var(--ic-brand-primary, #2b7abc); }
.sylla-layout button:focus-visible { outline: 2px solid var(--ic-brand-primary, #2b7abc); outline-offset: 2px; }
.sylla-hint { color: #616161; font-size: 0.875rem; margin: 0 0 8px; }
`

const text = (node: Node | null | undefined) => (node?.textContent ?? '').trim()

function itemsOf(question: HTMLElement): Item[] {
  return Array.from(question.querySelectorAll<HTMLSelectElement>('select.question_input'))
    .filter(select => !select.hasAttribute('readonly') && !select.disabled)
    .map(select => ({
      select,
      label: text(question.querySelector(`label[for="${select.id}"]`)),
    }))
}

const optionsOf = (select: HTMLSelectElement) =>
  Array.from(select.options).filter(option => option.value !== '')

// Sets a select to the option showing +label+ (or clears it) and tells the
// quiz page, which watches for changes to save answers.
function choose(select: HTMLSelectElement, label: string | null) {
  const option = optionsOf(select).find(o => text(o) === label)
  select.value = option ? option.value : ''
  select.dispatchEvent(new Event('change', {bubbles: true}))
}

const chosenLabel = (select: HTMLSelectElement) =>
  select.value === '' ? null : text(select.selectedOptions[0])

// The same order every time for the same question, so a reload doesn't
// reshuffle what the student is looking at.
function shuffled<T>(list: T[], seedText: string): T[] {
  let seed = 0
  for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const result = [...list]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Hides the selects and their labels; they still submit with the form.
// Returns the first hidden row, to put the new control in front of.
function hideRows(items: Item[]): HTMLElement | null {
  let first: HTMLElement | null = null
  items.forEach(({select}) => {
    const row = select.closest<HTMLElement>('.pull-left')
    const label = row?.previousElementSibling
    ;[label, row].forEach(node => {
      if (node instanceof HTMLElement && node.classList.contains('pull-left')) {
        node.style.display = 'none'
        first = first ?? node
      }
    })
  })
  return first
}

function announce(container: HTMLElement, message: string) {
  const live = container.querySelector<HTMLElement>('[role="status"]')
  if (live) live.textContent = message
}

function makeContainer(kind: string, hint: string): HTMLElement {
  const container = document.createElement('div')
  container.className = `sylla-layout sylla-layout--${kind}`
  const hintNode = document.createElement('p')
  hintNode.className = 'sylla-hint'
  hintNode.textContent = hint
  const live = document.createElement('div')
  live.setAttribute('role', 'status')
  live.className = 'screenreader-only'
  container.append(hintNode, live)
  return container
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = className
  el.textContent = label
  el.addEventListener('click', onClick)
  return el
}

export function enhanceOrdering(items: Item[]): boolean {
  const positions = optionsOf(items[0].select).map(o => text(o))
  const expected = items.map((_, i) => String(i + 1))
  const sameSet =
    positions.length === expected.length &&
    [...positions].sort((a, b) => Number(a) - Number(b)).every((p, i) => p === expected[i])
  if (!sameSet) return false

  // order[i] is the index of the item shown in position i + 1
  const stored = items.map(({select}) => chosenLabel(select))
  let order: number[]
  if (stored.every(label => label !== null && expected.includes(label))) {
    order = items.map((_, i) => i).sort((a, b) => Number(stored[a]) - Number(stored[b]))
  } else {
    order = shuffled(
      items.map((_, i) => i),
      items.map(({select}) => select.id).join(','),
    )
  }

  const container = makeContainer(
    'ordering',
    I18n.t('Put these in the right order. Use the arrows to move an item up or down.'),
  )
  const list = document.createElement('ol')
  list.className = 'sylla-order'
  container.append(list)

  // Nothing is submitted until the student moves something, so an untouched
  // question still counts as unanswered.
  const sync = () =>
    order.forEach((itemIndex, position) => choose(items[itemIndex].select, String(position + 1)))

  const render = (focus?: {itemIndex: number; direction: 'up' | 'down'}) => {
    list.replaceChildren()
    order.forEach((itemIndex, position) => {
      const li = document.createElement('li')
      const pos = document.createElement('span')
      pos.className = 'sylla-pos'
      pos.textContent = String(position + 1)
      pos.setAttribute('aria-hidden', 'true')
      const label = document.createElement('span')
      label.className = 'sylla-text'
      label.textContent = items[itemIndex].label
      const move = (by: number) => {
        const target = position + by
        ;[order[position], order[target]] = [order[target], order[position]]
        sync()
        announce(
          container,
          I18n.t('%{item} is now number %{position}', {
            item: items[itemIndex].label,
            position: target + 1,
          }),
        )
        render({itemIndex, direction: by < 0 ? 'up' : 'down'})
      }
      const up = button(I18n.t('Up'), 'sylla-up', () => move(-1))
      up.disabled = position === 0
      up.setAttribute('aria-label', I18n.t('Move %{item} up', {item: items[itemIndex].label}))
      const down = button(I18n.t('Down'), 'sylla-down', () => move(1))
      down.disabled = position === order.length - 1
      down.setAttribute('aria-label', I18n.t('Move %{item} down', {item: items[itemIndex].label}))
      li.append(pos, label, up, down)
      list.append(li)
      if (focus && focus.itemIndex === itemIndex) {
        const wanted = focus.direction === 'up' ? up : down
        const target = wanted.disabled ? (wanted === up ? down : up) : wanted
        queueMicrotask(() => target.focus())
      }
    })
  }
  render()

  hideRows(items)?.before(container)
  return true
}

export function enhanceCategorize(items: Item[]): boolean {
  const categories: string[] = []
  optionsOf(items[0].select).forEach(option => {
    const name = text(option)
    if (name && !categories.includes(name)) categories.push(name)
  })
  if (categories.length < 2) return false

  // where[i] is the category name item i is in, or null while it is unsorted
  const where: Array<string | null> = items.map(({select}) => chosenLabel(select))
  let picked: number | null = null

  const container = makeContainer(
    'categorize',
    I18n.t('Choose an item, then choose the group it belongs in.'),
  )
  const buckets = document.createElement('div')
  buckets.className = 'sylla-buckets'
  container.append(buckets)

  const place = (category: string | null) => {
    if (picked === null) return
    const itemIndex = picked
    where[itemIndex] = category
    picked = null
    choose(items[itemIndex].select, category)
    announce(
      container,
      category
        ? I18n.t('%{item} is in %{category}', {item: items[itemIndex].label, category})
        : I18n.t('%{item} is unsorted', {item: items[itemIndex].label}),
    )
    render()
  }

  const bucket = (title: string, category: string | null) => {
    const section = document.createElement('section')
    section.className = 'sylla-bucket'
    section.setAttribute('aria-label', title)
    const heading = document.createElement('h4')
    heading.textContent = title
    const list = document.createElement('ul')
    items.forEach((item, index) => {
      if (where[index] !== category) return
      const li = document.createElement('li')
      const chip = button(item.label, 'sylla-chip', () => {
        picked = picked === index ? null : index
        render()
      })
      chip.setAttribute('aria-pressed', String(picked === index))
      li.append(chip)
      list.append(li)
    })
    const put = button(
      category ? I18n.t('Put it in %{category}', {category}) : I18n.t('Move it back to unsorted'),
      'sylla-place',
      () => place(category),
    )
    put.disabled = picked === null || where[picked] === category
    section.append(heading, list, put)
    return section
  }

  const render = () => {
    buckets.replaceChildren(
      bucket(I18n.t('Not sorted yet'), null),
      ...categories.map(category => bucket(category, category)),
    )
  }
  render()

  hideRows(items)?.before(container)
  return true
}

export function enhanceQuestion(question: HTMLElement): boolean {
  if (question.dataset.syllaEnhanced) return false
  const layout = question.dataset.syllaLayout
  if (layout !== 'ordering' && layout !== 'categorize') return false

  const items = itemsOf(question)
  if (items.length < 2) return false

  const enhanced = layout === 'ordering' ? enhanceOrdering(items) : enhanceCategorize(items)
  if (enhanced) question.dataset.syllaEnhanced = 'true'
  return enhanced
}

export function initLayouts(root: ParentNode = document) {
  const questions = root.querySelectorAll<HTMLElement>(
    '.display_question[data-sylla-layout], .display_question[data-sylla-confidence], .display_question[data-sylla-unit-choices], .display_question[data-sylla-image]',
  )
  if (questions.length === 0) return
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = STYLES
    document.head.append(style)
  }
  questions.forEach(question => {
    if (question.classList.contains('matching_question')) enhanceQuestion(question)
    enhanceHotspot(question)
    enhanceUnit(question)
    enhanceConfidence(question)
  })
}
