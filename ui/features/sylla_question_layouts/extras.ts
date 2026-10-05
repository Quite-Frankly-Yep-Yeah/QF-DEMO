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
import {parseRegions, regionAt, type Region} from '@canvas/sylla-regions'

const I18n = createI18nScope('sylla_question_layouts')

// Three more options for a question on the take page, all read from data
// attributes the server puts on the question (SelfPaced quizzes helper
// sylla_question_data):
//
// - confidence: "How sure are you?" radios, posted as question_<id>_confidence
// - unit: a unit dropdown next to a numeric answer, posted as question_<id>_unit
// - hotspot: an image whose regions choose the matching multiple choice answer

const questionId = (question: HTMLElement) => question.id.replace(/^question_/, '')
const text = (node: Node | null | undefined) => (node?.textContent ?? '').trim()

function answersOf(question: HTMLElement): HTMLElement {
  return question.querySelector<HTMLElement>('.answers') ?? question
}

export function enhanceConfidence(question: HTMLElement): boolean {
  if (question.dataset.syllaConfidence !== '1' || question.querySelector('.sylla-confidence')) {
    return false
  }
  const id = questionId(question)
  if (!id) return false

  const levels: Array<[string, string]> = [
    ['guess', I18n.t('Just guessing')],
    ['unsure', I18n.t('Not sure')],
    ['sure', I18n.t('Sure')],
  ]
  const fieldset = document.createElement('fieldset')
  fieldset.className = 'sylla-confidence'
  fieldset.style.cssText = 'border: 0; margin: 16px 0 0; padding: 0;'
  const legend = document.createElement('legend')
  legend.style.cssText = 'font-size: 0.875rem; font-weight: 500; padding: 0; margin: 0 0 4px;'
  legend.textContent = I18n.t('How sure are you?')
  fieldset.append(legend)

  levels.forEach(([value, label]) => {
    const wrapper = document.createElement('label')
    wrapper.style.cssText =
      'display: inline-flex; align-items: center; gap: 4px; margin-right: 16px;'
    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = `question_${id}_confidence`
    radio.value = value
    radio.checked = question.dataset.syllaConfidenceValue === value
    wrapper.append(radio, document.createTextNode(label))
    fieldset.append(wrapper)
  })
  answersOf(question).append(fieldset)
  return true
}

export function enhanceUnit(question: HTMLElement): boolean {
  const choices = (question.dataset.syllaUnitChoices ?? '')
    .split(',')
    .map(choice => choice.trim())
    .filter(Boolean)
  const input = question.querySelector<HTMLInputElement>('input.question_input[type="text"]')
  if (choices.length === 0 || !input || question.querySelector('.sylla-unit')) return false
  const id = questionId(question)

  const select = document.createElement('select')
  select.className = 'question_input sylla-unit mathjax_ignore'
  select.name = `question_${id}_unit`
  select.style.cssText = 'margin-left: 8px;'
  select.setAttribute('aria-label', I18n.t('Unit'))
  const blank = document.createElement('option')
  blank.value = ''
  blank.textContent = I18n.t('[ unit ]')
  select.append(blank)
  choices.forEach(choice => {
    const option = document.createElement('option')
    option.value = choice
    option.textContent = choice
    option.selected = question.dataset.syllaUnitValue === choice
    select.append(option)
  })
  input.after(select)
  return true
}

export function enhanceHotspot(question: HTMLElement): boolean {
  const src = question.dataset.syllaImage
  const regions = parseRegions(question.dataset.syllaRegions ?? '')
  if (!src || regions.length === 0 || question.querySelector('.sylla-hotspot')) return false

  // each region chooses the radio whose label says the same thing
  const radios = new Map<string, HTMLInputElement>()
  question.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach(radio => {
    const label =
      text(question.querySelector(`label[for="${radio.id}"]`)) || text(radio.closest('label'))
    if (label) radios.set(label.toLowerCase(), radio)
  })
  const usable = regions.filter(region => radios.has(region.label.toLowerCase()))
  if (usable.length === 0) return false

  const wrapper = document.createElement('div')
  wrapper.className = 'sylla-hotspot'
  wrapper.style.cssText =
    'position: relative; display: inline-block; max-width: 100%; margin: 8px 0;'
  const image = document.createElement('img')
  image.src = src
  image.alt = I18n.t('Click the part of the picture that answers the question')
  image.style.cssText = 'display: block; max-width: 100%;'
  wrapper.append(image)

  const marks = new Map<Region, HTMLElement>()
  usable.forEach(region => {
    const mark = document.createElement('button')
    mark.type = 'button'
    mark.setAttribute('aria-label', region.label)
    mark.style.cssText = `position: absolute; left: ${region.x}%; top: ${region.y}%; width: ${region.width}%; height: ${region.height}%; box-sizing: border-box; padding: 0; border: 2px solid transparent; background: transparent; cursor: pointer;`
    mark.addEventListener('click', event => {
      event.stopPropagation()
      choose(region)
    })
    marks.set(region, mark)
    wrapper.append(mark)
  })

  const radioFor = (region: Region) => radios.get(region.label.toLowerCase())!
  const show = () => {
    marks.forEach((mark, region) => {
      const chosen = radioFor(region).checked
      mark.style.borderColor = chosen ? 'var(--ic-brand-primary, #2b7abc)' : 'transparent'
      mark.style.background = chosen ? 'rgba(43, 122, 188, 0.2)' : 'transparent'
      mark.setAttribute('aria-pressed', String(chosen))
    })
  }
  const choose = (region: Region) => {
    const radio = radioFor(region)
    radio.checked = true
    radio.dispatchEvent(new Event('change', {bubbles: true}))
    radio.dispatchEvent(new Event('click', {bubbles: true}))
    show()
  }
  // a click on the picture itself, outside any button
  wrapper.addEventListener('click', event => {
    const box = image.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return
    const hit = regionAt(
      usable,
      ((event.clientX - box.left) / box.width) * 100,
      ((event.clientY - box.top) / box.height) * 100,
    )
    if (hit) choose(hit)
  })
  radios.forEach(radio => radio.addEventListener('change', show))
  show()

  const list = answersOf(question)
  list.prepend(wrapper)
  return true
}
