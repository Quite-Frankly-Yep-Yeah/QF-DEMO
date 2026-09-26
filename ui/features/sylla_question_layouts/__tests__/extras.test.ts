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

import {within} from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import {enhanceConfidence, enhanceHotspot, enhanceUnit} from '../extras'
import {formatRegion, parseRegions, regionAt, regionFromDrag} from '../regions'
import {initLayouts} from '../layouts'

function question(html: string, data: Record<string, string>): HTMLElement {
  const root = document.createElement('div')
  root.id = 'question_42'
  root.className = 'display_question question'
  Object.entries(data).forEach(([key, value]) => {
    root.dataset[key] = value
  })
  root.innerHTML = `<div class="answers">${html}</div>`
  document.body.replaceChildren(root)
  return root
}

const numeric = '<input type="text" name="question_42" class="question_input">'
const choices = `
  <div class="answer"><input type="radio" id="a1" name="question_42" value="1"><label for="a1">Left bracket</label></div>
  <div class="answer"><input type="radio" id="a2" name="question_42" value="2"><label for="a2">Right bracket</label></div>`

describe('confidence', () => {
  it('asks how sure the student is, named for the question', async () => {
    const root = question(numeric, {syllaConfidence: '1'})
    expect(enhanceConfidence(root)).toBe(true)

    await userEvent.click(within(root).getByLabelText('Not sure'))

    const radios = root.querySelectorAll<HTMLInputElement>('input[name="question_42_confidence"]')
    expect(Array.from(radios).map(r => [r.value, r.checked])).toEqual([
      ['guess', false],
      ['unsure', true],
      ['sure', false],
    ])
  })

  it('shows the answer already given', () => {
    const root = question(numeric, {syllaConfidence: '1', syllaConfidenceValue: 'sure'})
    enhanceConfidence(root)

    expect(within(root).getByLabelText('Sure')).toBeChecked()
  })

  it('does nothing unless the question asks', () => {
    const root = question(numeric, {})

    expect(enhanceConfidence(root)).toBe(false)
  })
})

describe('units', () => {
  it('adds a unit dropdown after the number', () => {
    const root = question(numeric, {syllaUnitChoices: 'mm, cm, m'})
    expect(enhanceUnit(root)).toBe(true)

    const select = root.querySelector<HTMLSelectElement>('select[name="question_42_unit"]')!
    expect(Array.from(select.options).map(o => o.value)).toEqual(['', 'mm', 'cm', 'm'])
    expect(select.classList.contains('question_input')).toBe(true)
  })

  it('remembers the unit picked before', () => {
    const root = question(numeric, {syllaUnitChoices: 'mm, cm, m', syllaUnitValue: 'cm'})
    enhanceUnit(root)

    expect(root.querySelector<HTMLSelectElement>('select')!.value).toBe('cm')
  })

  it('leaves a plain numeric question alone', () => {
    expect(enhanceUnit(question(numeric, {}))).toBe(false)
  })
})

describe('hotspot', () => {
  const data = {
    syllaImage: '/images/diagram.png',
    syllaRegions: 'Left bracket | 10 | 10 | 30 | 30\nRight bracket | 60 | 10 | 30 | 30',
  }

  it('puts the image above the answers with a button for each region', () => {
    const root = question(choices, data)
    expect(enhanceHotspot(root)).toBe(true)

    expect(root.querySelector('img')).toHaveAttribute('src', '/images/diagram.png')
    expect(within(root).getByRole('button', {name: 'Left bracket'})).toBeInTheDocument()
    expect(within(root).getByRole('button', {name: 'Right bracket'})).toBeInTheDocument()
  })

  it('chooses the matching answer when a region is clicked', async () => {
    const root = question(choices, data)
    enhanceHotspot(root)

    await userEvent.click(within(root).getByRole('button', {name: 'Right bracket'}))

    expect(within(root).getByRole('radio', {name: 'Right bracket'})).toBeChecked()
    expect(within(root).getByRole('button', {name: 'Right bracket'})).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('follows the list when a choice is picked there', async () => {
    const root = question(choices, data)
    enhanceHotspot(root)

    await userEvent.click(within(root).getByRole('radio', {name: 'Left bracket'}))

    expect(within(root).getByRole('button', {name: 'Left bracket'})).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('needs regions that match a choice', () => {
    const root = question(choices, {...data, syllaRegions: 'Nothing like it | 0 | 0 | 10 | 10'})

    expect(enhanceHotspot(root)).toBe(false)
  })
})

describe('initLayouts', () => {
  it('adds every option a question asks for', () => {
    const root = question(numeric, {syllaConfidence: '1', syllaUnitChoices: 'mm, cm'})
    initLayouts(document)

    expect(root.querySelector('.sylla-confidence')).not.toBeNull()
    expect(root.querySelector('.sylla-unit')).not.toBeNull()
  })
})

describe('regions', () => {
  it('reads lines of choice, left, top, width and height', () => {
    expect(
      parseRegions('A | 1 | 2 | 3 | 4\n\nbad line\nB | x | 2 | 3 | 4\nC | 0 | 0 | 0 | 5'),
    ).toEqual([{label: 'A', x: 1, y: 2, width: 3, height: 4}])
  })

  it('writes a region back as a line', () => {
    const region = {label: 'A', x: 1, y: 2, width: 3, height: 4}

    expect(parseRegions(formatRegion(region))).toEqual([region])
  })

  it('finds the region under a point, latest first', () => {
    const big = {label: 'Big', x: 0, y: 0, width: 100, height: 100}
    const small = {label: 'Small', x: 40, y: 40, width: 10, height: 10}

    expect(regionAt([big, small], 45, 45)?.label).toBe('Small')
    expect(regionAt([big, small], 5, 5)?.label).toBe('Big')
    expect(regionAt([small], 5, 5)).toBeUndefined()
  })

  it('turns a drag into a region in percent, whichever corner it starts from', () => {
    const size = {width: 400, height: 200}

    expect(regionFromDrag({x: 200, y: 100}, {x: 40, y: 20}, size)).toEqual({
      label: 'Choice',
      x: 10,
      y: 10,
      width: 40,
      height: 40,
    })
  })

  it('ignores a click and keeps the region inside the image', () => {
    const size = {width: 100, height: 100}

    expect(regionFromDrag({x: 10, y: 10}, {x: 10, y: 10}, size)).toBeNull()
    expect(regionFromDrag({x: -20, y: 50}, {x: 150, y: 80}, size)).toMatchObject({x: 0, width: 100})
  })
})
