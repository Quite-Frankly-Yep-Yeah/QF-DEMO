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

import {accentVars} from '../color'
import {fitBesideNav, hasAnswer, initReader, LONG_READ_CHARS, shouldGate} from '../reader'

const LONG = 'word '.repeat(LONG_READ_CHARS / 4)

function question(id: number, type: string, text: string, checked = false): string {
  return `
    <div class="question_holder">
      <div class="display_question question ${type}" id="question_${id}">
        <div class="header"><span class="question_name">Question ${id}</span></div>
        <div class="text">
          <div class="question_text user_content">${text}</div>
          <div class="answers">
            <label class="answer_row"><input type="radio" name="q${id}" value="1" ${
              checked ? 'checked' : ''
            } /></label>
            <label class="answer_row"><input type="radio" name="q${id}" value="2" /></label>
          </div>
          <div class="after_answers"></div>
        </div>
      </div>
    </div>`
}

function page(...questions: string[]) {
  document.body.innerHTML = `
    <div id="questions">${questions.join('')}</div>
    <div class="form-actions">
      <span id="last_saved_indicator">Not saved</span>
      <button id="submit_quiz_button" type="submit">Submit</button>
    </div>
    <ul id="question_list">
      ${questions.map((_, i) => `<li id="list_question_${i + 1}"><a class="jump_to_question_link" href="#question_${i + 1}">Question ${i + 1}</a></li>`).join('')}
    </ul>`
}

const button = (label: string) =>
  Array.from(document.querySelectorAll('button')).find(
    b => b.textContent === label,
  ) as HTMLButtonElement

describe('accentVars', () => {
  it('darkens a light color until white text reads on it', () => {
    const {accent, strong} = accentVars('#ffee58')!
    expect(accent).toBe('#ffee58')
    expect(strong).not.toBe(accent)
  })

  it('keeps a dark color as it is', () => {
    expect(accentVars('#1f5fae')!.strong).toBe('#1f5fae')
  })

  it('ignores values that are not hex colors', () => {
    expect(accentVars('rebeccapurple')).toBeNull()
    expect(accentVars(null)).toBeNull()
  })
})

describe('hasAnswer and shouldGate', () => {
  it('sees a checked radio as an answer', () => {
    page(question(1, 'multiple_choice_question', 'short', true))
    expect(hasAnswer(document.querySelector('.question_holder')!)).toBe(true)
  })

  it('gates long reading with no answer yet', () => {
    page(question(1, 'multiple_choice_question', LONG))
    expect(shouldGate(document.querySelector('.question_holder')!, LONG)).toBe(true)
  })

  it('does not gate short questions, answered ones or essays', () => {
    page(
      question(1, 'multiple_choice_question', 'short'),
      question(2, 'multiple_choice_question', LONG, true),
      question(3, 'essay_question', LONG),
    )
    const [a, b, c] = Array.from(document.querySelectorAll('.question_holder'))
    expect(shouldGate(a, 'short')).toBe(false)
    expect(shouldGate(b, LONG)).toBe(false)
    expect(shouldGate(c, LONG)).toBe(false)
  })
})

describe('fitBesideNav', () => {
  const rect = (r: Partial<DOMRect>) => () =>
    ({top: 0, left: 0, width: 0, height: 0, ...r}) as DOMRect

  beforeEach(() => {
    document.body.innerHTML = '<header id="header"></header><div id="content"></div>'
    Object.defineProperty(window, 'innerWidth', {value: 1000, configurable: true})
    Object.defineProperty(window, 'innerHeight', {value: 800, configurable: true})
  })

  it('leaves room below a top bar', () => {
    document.getElementById('header')!.getBoundingClientRect = rect({
      width: 1000,
      height: 62,
      bottom: 62,
    })
    fitBesideNav()
    expect(document.body.style.getPropertyValue('--sp-nav-top')).toBe('62px')
    expect(document.body.style.getPropertyValue('--sp-nav-start')).toBe('0px')
  })

  it('leaves room beside a side rail', () => {
    document.getElementById('header')!.getBoundingClientRect = rect({
      width: 84,
      height: 800,
      bottom: 800,
    })
    fitBesideNav()
    expect(document.body.style.getPropertyValue('--sp-nav-top')).toBe('0px')
    expect(document.body.style.getPropertyValue('--sp-nav-start')).toBe('84px')
  })
})

describe('initReader', () => {
  beforeEach(() => {
    window.ENV = {} as typeof window.ENV
  })

  it('shows one question at a time and steps with Back and Next', () => {
    page(
      question(1, 'multiple_choice_question', 'one'),
      question(2, 'multiple_choice_question', 'two'),
    )
    initReader()
    const holders = document.querySelectorAll('.question_holder')
    expect(holders[0].classList.contains('sp-active')).toBe(true)
    expect(holders[1].classList.contains('sp-active')).toBe(false)
    expect(document.querySelector('.sp-progress__step')!.textContent).toContain('1')
    expect(button('Back').disabled).toBe(true)

    button('Next').click()
    expect(holders[1].classList.contains('sp-active')).toBe(true)
    expect(document.getElementById('list_question_2')!.classList.contains('sp-current')).toBe(true)
    expect(button('Next').hidden).toBe(true)
    expect(button('Back').disabled).toBe(false)
  })

  it('splits each question into a read card and an answer card', () => {
    page(question(1, 'multiple_choice_question', 'one'))
    initReader()
    const text = document.querySelector('.text')!
    expect(text.querySelector('.sp-read .question_text')).not.toBeNull()
    expect(text.querySelector('.sp-answer .answers')).not.toBeNull()
  })

  it('keeps answers hidden until a long question has been read', () => {
    page(question(1, 'multiple_choice_question', LONG))
    initReader()
    const body = document.querySelector<HTMLElement>('.sp-answer-body')!
    expect(body.hidden).toBe(true)
    button("I've read it").click()
    expect(body.hidden).toBe(false)
    expect(document.querySelector('.sp-gate')).toBeNull()
  })

  it('opens the question the sidebar list points at', () => {
    page(
      question(1, 'multiple_choice_question', 'one'),
      question(2, 'multiple_choice_question', 'two'),
    )
    initReader()
    document.querySelector<HTMLElement>('a[href="#question_2"]')!.click()
    expect(document.querySelectorAll('.question_holder')[1].classList.contains('sp-active')).toBe(
      true,
    )
  })

  it('resumes at the first unanswered question', () => {
    page(
      question(1, 'multiple_choice_question', 'one', true),
      question(2, 'multiple_choice_question', 'two'),
    )
    initReader()
    expect(document.querySelectorAll('.question_holder')[1].classList.contains('sp-active')).toBe(
      true,
    )
    expect(document.querySelector('.sp-progress__answered')!.textContent).toContain('1')
  })
})
