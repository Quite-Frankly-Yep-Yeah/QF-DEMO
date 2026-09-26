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

import {screen, within} from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import {enhanceQuestion, initLayouts} from '../layouts'

// The markup the take page renders for a matching question
// (app/views/quizzes/quizzes/_multi_answer.html.erb).
function question(
  layout: string,
  items: string[],
  options: string[],
  chosen: Array<string | null> = [],
): HTMLElement {
  const root = document.createElement('div')
  root.className = 'display_question question matching_question'
  root.dataset.syllaLayout = layout
  root.innerHTML = items
    .map(
      (item, i) => `
    <div class="pull-left"><label for="q1_a${i}">${item}</label></div>
    <div class="pull-left">
      <select id="q1_a${i}" name="q1_a${i}" class="question_input">
        <option value="">[ Choose ]</option>
        ${options
          .map(o => `<option value="${o}" ${chosen[i] === o ? 'selected' : ''}>${o}</option>`)
          .join('')}
      </select>
    </div>
    <div class="clear"></div>`,
    )
    .join('')
  document.body.replaceChildren(root)
  return root
}

const values = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('select')).map(select => select.value)

describe('ordering layout', () => {
  const ITEMS = ['Mix', 'Bake', 'Cool', 'Frost']

  it('shows the items in a list with arrows and hides the selects', () => {
    const root = question('ordering', ITEMS, ['1', '2', '3', '4'])
    expect(enhanceQuestion(root)).toBe(true)

    const list = within(root).getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    expect(root.querySelector<HTMLElement>('.pull-left')?.style.display).toBe('none')
  })

  it('submits nothing until the student moves an item', () => {
    const root = question('ordering', ITEMS, ['1', '2', '3', '4'])
    enhanceQuestion(root)

    expect(values(root)).toEqual(['', '', '', ''])
  })

  it('writes each item position into its select when moved', async () => {
    const root = question('ordering', ITEMS, ['1', '2', '3', '4'])
    enhanceQuestion(root)
    const seen: string[] = []
    root.addEventListener('change', event => seen.push((event.target as HTMLSelectElement).id))

    const first = within(root).getAllByRole('listitem')[0]
    const name = first.querySelector('.sylla-text')!.textContent!
    await userEvent.click(within(first).getByRole('button', {name: `Move ${name} down`}))

    const chosen = values(root)
    expect([...chosen].sort()).toEqual(['1', '2', '3', '4'])
    // the item that was first is now number 2
    const select = root.querySelector<HTMLSelectElement>(`select[id="q1_a${ITEMS.indexOf(name)}"]`)!
    expect(select.value).toBe('2')
    expect(seen).toHaveLength(4)
    expect(screen.queryAllByRole('status')[0]).toHaveTextContent(`${name} is now number 2`)
  })

  it('shows the items in the order already chosen', () => {
    const root = question('ordering', ITEMS, ['1', '2', '3', '4'], ['3', '1', '4', '2'])
    enhanceQuestion(root)

    const shown = within(root)
      .getAllByRole('listitem')
      .map(li => li.querySelector('.sylla-text')!.textContent)
    expect(shown).toEqual(['Bake', 'Frost', 'Mix', 'Cool'])
  })

  it('shows the same order after a reload', () => {
    const shownOrder = () => {
      const root = question('ordering', ITEMS, ['1', '2', '3', '4'])
      enhanceQuestion(root)
      return within(root)
        .getAllByRole('listitem')
        .map(li => li.querySelector('.sylla-text')!.textContent)
    }

    expect(shownOrder()).toEqual(shownOrder())
  })

  it('leaves the selects alone when the options are not positions', () => {
    const root = question('ordering', ITEMS, ['first', 'second', 'third', 'fourth'])

    expect(enhanceQuestion(root)).toBe(false)
    expect(root.querySelector<HTMLElement>('.pull-left')?.style.display).not.toBe('none')
  })
})

describe('categorize layout', () => {
  const ITEMS = ['Oak', 'Salmon', 'Maple']
  const CATEGORIES = ['Tree', 'Fish']

  it('starts with every item unsorted', () => {
    const root = question('categorize', ITEMS, CATEGORIES)
    expect(enhanceQuestion(root)).toBe(true)

    const unsorted = within(root).getByRole('region', {name: 'Not sorted yet'})
    expect(within(unsorted).getAllByRole('button', {pressed: false})).toHaveLength(3)
  })

  it('moves an item into a category and sets its select', async () => {
    const root = question('categorize', ITEMS, CATEGORIES)
    enhanceQuestion(root)

    await userEvent.click(within(root).getByRole('button', {name: 'Salmon'}))
    await userEvent.click(within(root).getByRole('button', {name: 'Put it in Fish'}))

    expect(values(root)).toEqual(['', 'Fish', ''])
    const fish = within(root).getByRole('region', {name: 'Fish'})
    expect(within(fish).getByRole('button', {name: 'Salmon'})).toBeInTheDocument()
  })

  it('lets an item go back to unsorted', async () => {
    const root = question('categorize', ITEMS, CATEGORIES, ['Tree', null, null])
    enhanceQuestion(root)

    await userEvent.click(within(root).getByRole('button', {name: 'Oak'}))
    await userEvent.click(within(root).getByRole('button', {name: 'Move it back to unsorted'}))

    expect(values(root)).toEqual(['', '', ''])
  })

  it('leaves the selects alone with fewer than two categories', () => {
    const root = question('categorize', ITEMS, ['Tree'])

    expect(enhanceQuestion(root)).toBe(false)
  })
})

describe('initLayouts', () => {
  it('only touches questions that have a layout', () => {
    const plain = question('', ['A', 'B'], ['1', '2'])
    plain.removeAttribute('data-sylla-layout')

    initLayouts(document)

    expect(plain.querySelector('.sylla-layout')).toBeNull()
  })
})
