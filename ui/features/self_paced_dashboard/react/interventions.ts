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
import doFetchApi from '@canvas/do-fetch-api-effect'
import {formatPlanDate} from '@canvas/self-paced/pacing'
import type {DetailItem, InterventionKind, LogEntry, OverrideKind, Tools} from './types'

const I18n = createI18nScope('self_paced_dashboard')

// One thing staff can do to an item from the tray's item menu.
export type ItemAction = {
  kind: InterventionKind
  overrideKind?: OverrideKind // for "undo"
  label: string
  // what the confirmation dialog says the action does
  explanation: string
  askAttempts?: boolean
}

// The actions an item offers the viewer. An override already in place is
// offered as its undo instead.
export function itemActions(item: DetailItem, tools: Tools): ItemAction[] {
  const has = (kind: OverrideKind) => item.overrides?.includes(kind) ?? false
  const actions: ItemAction[] = []

  if (tools.unlock) {
    actions.push(
      has('unlock')
        ? {
            kind: 'undo',
            overrideKind: 'unlock',
            label: I18n.t('Lock again'),
            explanation: I18n.t('The item follows the course rules again.'),
          }
        : {
            kind: 'unlock',
            label: I18n.t('Unlock'),
            explanation: I18n.t(
              'The student can open this item now, even if the items before it are not done.',
            ),
          },
    )
  }
  if (tools.mark_complete && !has('exempt')) {
    actions.push(
      has('complete')
        ? {
            kind: 'undo',
            overrideKind: 'complete',
            label: I18n.t('Undo mark complete'),
            explanation: I18n.t('The item counts as done only when the student finishes it.'),
          }
        : {
            kind: 'mark_complete',
            label: I18n.t('Mark complete'),
            explanation: I18n.t(
              'The item counts as done, so the student can move on. Grades are not changed.',
            ),
          },
    )
  }
  const canExempt = tools.exempt && (!item.graded || tools.exempt_graded)
  if (canExempt) {
    actions.push(
      has('exempt')
        ? {
            kind: 'undo',
            overrideKind: 'exempt',
            label: I18n.t('Undo exemption'),
            explanation: item.graded
              ? I18n.t('The item is required again and its grade counts again.')
              : I18n.t('The item is required again.'),
          }
        : {
            kind: 'exempt',
            label: I18n.t('Exempt'),
            explanation: item.graded
              ? I18n.t(
                  "The student skips this item. It's excused in the gradebook, so it doesn't count toward the grade.",
                )
              : I18n.t("The student skips this item and it's left out of their pace."),
          },
    )
  }
  if (item.attempts_limited && tools.extra_attempts) {
    actions.push({
      kind: 'extra_attempts',
      label: I18n.t('Give extra tries'),
      explanation: I18n.t('The student gets more tries on this item.'),
      askAttempts: true,
    })
  }
  if (item.attempts_limited && tools.reset_attempt) {
    actions.push({
      kind: 'reset_attempt',
      label: I18n.t('Reset last try'),
      explanation: I18n.t(
        'The student gets one more try. The last try and its score stay in the history.',
      ),
    })
  }
  return actions
}

// A short badge for each override on an item.
export function overrideLabel(kind: OverrideKind): string {
  switch (kind) {
    case 'unlock':
      return I18n.t('Unlocked')
    case 'exempt':
      return I18n.t('Exempt')
    case 'complete':
      return I18n.t('Marked complete')
  }
}

// One line for the history, in plain words.
export function describeEntry(entry: LogEntry): string {
  const title = entry.item?.title ?? ''
  const payload = entry.payload
  switch (entry.kind) {
    case 'unlock':
      return I18n.t('Unlocked %{title}', {title})
    case 'mark_complete':
      return I18n.t('Marked %{title} complete', {title})
    case 'exempt':
      return payload.excused
        ? I18n.t('Exempted %{title} and excused its grade', {title})
        : I18n.t('Exempted %{title}', {title})
    case 'undo':
      switch (payload.override_kind) {
        case 'unlock':
          return I18n.t('Locked %{title} again', {title})
        case 'exempt':
          return I18n.t('Took back the exemption on %{title}', {title})
        default:
          return I18n.t('Took back marking %{title} complete', {title})
      }
    case 'extra_attempts':
      return I18n.t(
        {one: 'Gave 1 extra try on %{title}', other: 'Gave %{count} extra tries on %{title}'},
        {count: Number(payload.attempts ?? 1), title},
      )
    case 'reset_attempt': {
      const reset = (payload.reset_attempt ?? {}) as {attempt?: number; score?: number | null}
      return typeof reset.score === 'number'
        ? I18n.t('Reset try %{n} on %{title} (it scored %{score})', {
            n: reset.attempt,
            title,
            score: reset.score,
          })
        : I18n.t('Reset try %{n} on %{title}', {n: reset.attempt, title})
    }
    case 'adjust_target':
      return payload.source === 'default'
        ? I18n.t("Went back to the course's finish date (%{date})", {
            date: formatPlanDate(String(payload.to)),
          })
        : I18n.t('Set the finish date to %{date}', {date: formatPlanDate(String(payload.to))})
    case 'note':
      return I18n.t('Added a note')
    case 'delete_note':
      return I18n.t('Deleted a note')
    case 'message':
      return I18n.t('Sent a message: %{subject}', {subject: String(payload.subject ?? '')})
  }
}

export type InterventionBody = {
  kind: InterventionKind
  content_tag_id?: string
  override_kind?: OverrideKind
  reason?: string
  attempts?: number
  body?: string
  subject?: string
  note_id?: string
}

// The server's explanation when it turns an action down, if it gave one.
export async function errorMessage(error: unknown): Promise<string | null> {
  const response = (error as {response?: Response})?.response
  if (!response) return null
  try {
    const json = await response.clone().json()
    return Array.isArray(json?.errors) ? String(json.errors[0]) : null
  } catch {
    return null
  }
}

export type BulkResult = {
  done: number
  failed: {course_id: string; student_id: string; name: string | null; error: string}[]
}

type ProgressJson = {
  id: string
  url: string
  workflow_state: 'queued' | 'running' | 'completed' | 'failed'
  results?: BulkResult
}

// Starts a bulk action and waits for its job to finish.
export async function runBulk(
  url: string,
  body: Record<string, unknown>,
  {intervalMs = 1000, maxPolls = 120} = {},
): Promise<BulkResult> {
  const {json} = await doFetchApi<ProgressJson>({path: url, method: 'POST', body})
  let progress = json as ProgressJson
  for (let i = 0; i < maxPolls; i++) {
    if (progress.workflow_state === 'completed' && progress.results) return progress.results
    if (progress.workflow_state === 'failed') throw new Error('bulk action failed')
    await new Promise(resolve => setTimeout(resolve, intervalMs))
    const next = await doFetchApi<ProgressJson>({path: `/api/v1/progress/${progress.id}`})
    progress = next.json as ProgressJson
  }
  throw new Error('bulk action timed out')
}
