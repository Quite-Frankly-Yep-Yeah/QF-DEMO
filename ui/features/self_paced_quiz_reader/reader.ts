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
import {accentVars} from './color'

const I18n = createI18nScope('self_paced_quiz_reader')

// Questions with at least this much text ask the student to read before the
// answers appear.
export const LONG_READ_CHARS = 350

// Question types where the answer area is the task itself (an editor or an
// upload), so hiding it behind a gate would only get in the way.
const NEVER_GATED = ['essay_question', 'file_upload_question']

const TEXT_ONLY = 'text_only_question'

// Whether the student has put anything into a question's answer inputs. Read
// from the DOM rather than from the classic quiz's "answered" class, which is
// only set after its own JS has run.
export function hasAnswer(holder: Element): boolean {
  const inputs = holder.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >(
    '.answers input, .answers select, .answers textarea, .question_text select, .question_text input',
  )
  return Array.from(inputs).some(input => {
    if (input instanceof HTMLInputElement) {
      if (input.type === 'hidden' || input.type === 'file') return false
      if (input.type === 'radio' || input.type === 'checkbox') return input.checked
    }
    return input.value.trim() !== ''
  })
}

export function shouldGate(holder: Element, readingText: string): boolean {
  const question = holder.querySelector('.display_question')
  if (!question || question.classList.contains(TEXT_ONLY)) return false
  if (NEVER_GATED.some(type => question.classList.contains(type))) return false
  return readingText.trim().length >= LONG_READ_CHARS && !hasAnswer(holder)
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function firstFocusable(root: Element): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    'input:not([type=hidden]), select, textarea, button, a[href]',
  )
}

// Wraps a question's text and answers in two cards, "Read" and "Your answer".
// A long question hides its answers behind an "I've read it" button.
function buildStages(holder: HTMLElement): void {
  const question = holder.querySelector<HTMLElement>('.display_question')
  const text = question?.querySelector<HTMLElement>(':scope > .text')
  const questionText = text?.querySelector<HTMLElement>(':scope > .question_text')
  if (!question || !text || !questionText || text.querySelector('.sp-read')) return

  const read = el('section', 'sp-read')
  read.setAttribute('aria-label', I18n.t('Read'))
  read.append(el('div', 'sp-stage', I18n.t('Read')))
  text.insertBefore(read, questionText)
  read.append(questionText)

  if (question.classList.contains(TEXT_ONLY)) {
    read.classList.add('sp-read--solo')
    return
  }

  const answers = text.querySelector<HTMLElement>(':scope > .answers')
  const after = text.querySelector<HTMLElement>(':scope > .after_answers')
  if (!answers) return

  const answer = el('section', 'sp-answer')
  answer.setAttribute('aria-label', I18n.t('Your answer'))
  answer.append(el('div', 'sp-stage', I18n.t('Your answer')))
  const body = el('div', 'sp-answer-body')
  body.append(answers)
  if (after) body.append(after)
  answer.append(body)
  read.after(answer)

  if (shouldGate(holder, questionText.textContent ?? '')) {
    const gate = el('div', 'sp-gate')
    gate.append(el('p', undefined, I18n.t('Read the question first, then show the answers.')))
    const open = el('button', 'sp-btn sp-btn--raised sp-btn--gate', I18n.t("I've read it"))
    open.type = 'button'
    gate.append(open)
    body.hidden = true
    answer.append(gate)
    open.addEventListener('click', () => {
      body.hidden = false
      gate.remove()
      firstFocusable(body)?.focus()
    })
  }
}

// The reader is a fixed layer over the page, but the global nav stays visible.
// Measure whichever nav is showing and leave room for it: below a top bar, or
// beside a side rail. The stylesheet reads --sp-nav-top and --sp-nav-start.
export function fitBesideNav(): void {
  let top = 0
  let start = 0
  const content = document.getElementById('content')
  const candidates = document.querySelectorAll<HTMLElement>(
    '#application > *, body > *, #header, #mobile-header, header, [role="banner"]',
  )
  for (const nav of candidates) {
    if (nav.contains(content) || content?.contains(nav) || nav.id.startsWith('flash')) continue
    if (getComputedStyle(nav).display === 'none') continue
    const rect = nav.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    if (rect.top <= 1 && rect.width >= window.innerWidth / 2) {
      top = Math.max(top, Math.round(rect.bottom))
    } else if (rect.left <= 1 && rect.height >= window.innerHeight / 2) {
      start = Math.max(start, Math.round(rect.width))
    }
  }
  document.body.style.setProperty('--sp-nav-top', `${Math.max(0, top)}px`)
  document.body.style.setProperty('--sp-nav-start', `${start}px`)
}

export function initReader(): void {
  const questions = document.getElementById('questions')
  if (!questions) return

  const holders = Array.from(questions.querySelectorAll<HTMLElement>('.question_holder')).filter(
    holder => holder.id !== 'question_template' && holder.querySelector('.display_question'),
  )
  if (holders.length === 0) return

  const accent = accentVars(
    (window.ENV as {SELF_PACED_PLAYER_BAR?: {course_color?: string | null}}).SELF_PACED_PLAYER_BAR
      ?.course_color,
  )
  if (accent) {
    document.body.style.setProperty('--sp-accent', accent.accent)
    document.body.style.setProperty('--sp-accent-strong', accent.strong)
    document.body.style.setProperty('--sp-accent-rgb', accent.rgb)
  }

  holders.forEach(buildStages)

  // The app bar: exit, title, where you are, the clock and the question chips.
  // The clock and the question list are the classic quiz's own elements, moved
  // here from the sidebar so its scripts keep updating them.
  const appbar = el('div', 'sp-appbar')
  const row = el('div', 'sp-appbar__row')

  const exit = el('a', 'sp-appbar__exit')
  const config = (window.ENV as {SELF_PACED_PLAYER_BAR?: {player_url?: string}})
    .SELF_PACED_PLAYER_BAR
  exit.href =
    config?.player_url || (window.ENV as {QUIZ?: {html_url?: string}}).QUIZ?.html_url || '/'
  exit.setAttribute('aria-label', I18n.t('Exit quiz'))
  exit.title = I18n.t('Exit quiz')

  const title = el('div', 'sp-appbar__title')
  const heading = el(
    'h1',
    undefined,
    document.querySelector('.quiz-header h1')?.textContent?.trim(),
  )
  title.append(heading)

  const stepLabel = el('div', 'sp-progress__step')
  stepLabel.setAttribute('aria-live', 'polite')
  stepLabel.setAttribute('aria-atomic', 'true')
  const answeredLabel = el('div', 'sp-progress__answered')
  const where = el('div', 'sp-progress__text')
  where.append(stepLabel, answeredLabel)

  row.append(exit, title, where)
  const preview = document.getElementById('preview_mode_link')
  if (preview) row.append(preview)
  const clock = document.getElementById('quiz-time-elapsed')
  if (clock) row.append(clock)

  // The classic question list stays in the page, out of sight: its scripts
  // keep marking questions answered there, and Submit reads it.
  const chips = el('nav', 'sp-appbar__chips')
  chips.hidden = true
  const list = document.getElementById('question_list')
  if (list) chips.append(list)

  const track = el('div', 'sp-progress__track')
  track.setAttribute('role', 'progressbar')
  track.setAttribute('aria-label', I18n.t('Question progress'))
  track.setAttribute('aria-valuemin', '1')
  track.setAttribute('aria-valuemax', String(holders.length))
  const fill = el('div', 'sp-progress__fill')
  track.append(fill)

  appbar.append(row, chips, track)
  const content = document.getElementById('content')
  if (content) content.prepend(appbar)
  else questions.before(appbar)

  // back and next, in the sticky bar beside "Submit Quiz"
  const nav = el('div', 'sp-nav')
  const back = el('button', 'sp-btn sp-btn--back', I18n.t('Back'))
  const next = el('button', 'sp-btn sp-btn--raised sp-btn--next', I18n.t('Next'))
  back.type = 'button'
  next.type = 'button'
  nav.append(back, next)
  const bar = document.querySelector('.form-actions')
  const submit = bar?.querySelector('#submit_quiz_button')
  if (bar && submit) bar.insertBefore(nav, submit)
  else questions.append(nav)

  const listItem = (holder: HTMLElement) => {
    const id = holder.querySelector('.display_question')?.id
    return id ? document.getElementById(`list_${id}`) : null
  }

  let current = -1

  const updateCounts = () => {
    const answerable = holders.filter(h => !h.querySelector(`.display_question.${TEXT_ONLY}`))
    const done = answerable.filter(
      h => hasAnswer(h) || h.querySelector('.question.answered'),
    ).length
    answeredLabel.textContent = I18n.t('%{done} of %{total} answered', {
      done,
      total: answerable.length,
    })
  }

  const show = (index: number, moveFocus: boolean) => {
    const target = Math.max(0, Math.min(holders.length - 1, index))
    if (target === current) return
    current = target
    holders.forEach((holder, i) => {
      holder.classList.toggle('sp-active', i === target)
      listItem(holder)?.classList.toggle('sp-current', i === target)
    })
    listItem(holders[target])?.scrollIntoView({block: 'nearest', inline: 'center'})
    stepLabel.textContent = I18n.t('Question %{current} of %{total}', {
      current: target + 1,
      total: holders.length,
    })
    track.setAttribute('aria-valuenow', String(target + 1))
    fill.style.width = `${((target + 1) / holders.length) * 100}%`
    back.disabled = target === 0
    next.hidden = target === holders.length - 1
    document.body.classList.toggle('sp-last-step', target === holders.length - 1)
    if (moveFocus) {
      const heading = holders[target].querySelector<HTMLElement>('.question_name')
      if (heading) {
        heading.tabIndex = -1
        heading.focus({preventScroll: true})
      }
      holders[target].scrollIntoView({block: 'start'})
    }
  }

  back.addEventListener('click', () => show(current - 1, true))
  next.addEventListener('click', () => show(current + 1, true))

  // The sidebar's question list jumps to a question; open it first so the
  // classic handler can scroll to it and focus its first input.
  document.addEventListener(
    'click',
    event => {
      const link = (event.target as Element | null)?.closest(
        '#question_list .jump_to_question_link',
      )
      const id = link?.getAttribute('href')?.replace(/^#/, '')
      if (!id) return
      const index = holders.findIndex(h => h.querySelector('.display_question')?.id === id)
      if (index >= 0) show(index, false)
    },
    true,
  )

  fitBesideNav()
  window.addEventListener('resize', fitBesideNav)
  window.addEventListener('load', fitBesideNav)

  questions.addEventListener('input', updateCounts)
  questions.addEventListener('change', updateCounts)
  let frame = 0
  new MutationObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(updateCounts)
  }).observe(questions, {subtree: true, attributes: true, attributeFilter: ['class']})

  // pick up where the student left off
  const firstOpen = holders.findIndex(
    h => !h.querySelector(`.display_question.${TEXT_ONLY}`) && !hasAnswer(h),
  )
  questions.classList.add('sp-reader-ready')
  show(firstOpen > 0 && holders.some(h => hasAnswer(h)) ? firstOpen : 0, false)
  updateCounts()
}
