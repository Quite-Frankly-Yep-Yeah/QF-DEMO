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

import React, {useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import ActionDialog, {type DialogSpec, type DialogValues} from './ActionDialog'
import {isStuck} from './format'
import {groupByStudent} from './grouping'
import {errorMessage, runBulk, type BulkResult} from './interventions'
import {ELEVATION, ROBOTO} from './material'
import type {CourseSummary, RosterRow, Tools} from './types'

const I18n = createI18nScope('self_paced_dashboard')

type Props = {
  url: string
  rows: RosterRow[] // every row of the selected students
  onClear: () => void
  onDone: () => void
  pollMs?: number
  // on a course page: the course's items and the viewer's tools, for acting
  // on one item for every selected student
  items?: CourseSummary['items']
  tools?: Tools
}

type Target = {course_id: string; student_id: string}

// The bar that appears while students are ticked in the roster. Messages and
// notes go once per student; an extra try goes to each class where the
// student is stuck.
export default function BulkBar({url, rows, onClear, onDone, pollMs, items, tools}: Props) {
  const [dialog, setDialog] = useState<{
    spec: DialogSpec
    run: (values: DialogValues) => Promise<void>
  } | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const groups = groupByStudent(rows)
  const perStudent: Target[] = groups.map(group => ({
    course_id: group.primary.course.id,
    student_id: group.student.id,
  }))
  const stuck: Target[] = rows
    .filter(isStuck)
    .map(row => ({course_id: row.course.id, student_id: row.student.id}))

  const start =
    (kind: string, targets: Target[], extra: (values: DialogValues) => Record<string, unknown>) =>
    async (values: DialogValues) => {
      let outcome: BulkResult
      try {
        outcome = await runBulk(url, {kind, targets, ...extra(values)}, {intervalMs: pollMs})
      } catch (e) {
        throw new Error(
          (await errorMessage(e)) ??
            I18n.t("That didn't work. Check your connection and try again."),
        )
      }
      setDialog(null)
      setResult(summarize(outcome))
      onDone()
    }

  const button = (label: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 12px',
        border: 'none',
        borderRadius: 2,
        background: 'transparent',
        color: disabled ? 'rgba(255,255,255,0.5)' : '#8fd6ff',
        fontFamily: ROBOTO,
        fontSize: '0.875rem',
        fontWeight: 500,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  )

  const count = groups.length

  // what can be done to one item for the whole selection
  const itemActions = tools
    ? [
        tools.unlock && {value: 'unlock', label: I18n.t('Unlock')},
        tools.mark_complete && {value: 'mark_complete', label: I18n.t('Mark complete')},
        tools.exempt && {value: 'exempt', label: I18n.t('Exempt')},
        tools.extra_attempts && {
          value: 'extra_attempts',
          label: I18n.t('Give extra tries'),
          askAttempts: true,
        },
        tools.reset_attempt && {value: 'reset_attempt', label: I18n.t('Reset last try')},
      ].filter(
        (action): action is {value: string; label: string; askAttempts?: boolean} => !!action,
      )
    : []
  return (
    <>
      <div
        role="region"
        aria-label={I18n.t('Actions for selected students')}
        style={{
          position: 'sticky',
          bottom: 16,
          zIndex: 3,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '4px 8px',
          margin: '16px 0',
          padding: '8px 16px',
          borderRadius: 2,
          background: '#323232',
          color: '#fff',
          boxShadow: ELEVATION[8],
          fontFamily: ROBOTO,
        }}
      >
        <span style={{fontWeight: 500, marginRight: 8}}>
          {I18n.t({one: '1 student selected', other: '%{count} students selected'}, {count})}
        </span>
        {button(I18n.t('Message'), () =>
          setDialog({
            spec: {
              title: I18n.t(
                {one: 'Message 1 student', other: 'Message %{count} students'},
                {count},
              ),
              explanation: I18n.t('Each student gets their own copy; replies come back to you.'),
              confirmLabel: I18n.t('Send'),
              askSubject: true,
              askBody: {label: I18n.t('Message')},
            },
            run: start('message', perStudent, v => ({subject: v.subject, body: v.body})),
          }),
        )}
        {button(I18n.t('Add note'), () =>
          setDialog({
            spec: {
              title: I18n.t(
                {one: 'Add a note to 1 student', other: 'Add a note to %{count} students'},
                {count},
              ),
              explanation: I18n.t('Only staff can see notes.'),
              confirmLabel: I18n.t('Save note'),
              askBody: {label: I18n.t('Note')},
            },
            run: start('note', perStudent, v => ({body: v.body})),
          }),
        )}
        {button(
          I18n.t('Extra try where stuck (%{count})', {count: stuck.length}),
          () =>
            setDialog({
              spec: {
                title: I18n.t('Give an extra try where stuck'),
                explanation: I18n.t(
                  {
                    one: 'One class has a selected student stuck on an item. They get more tries on that item.',
                    other:
                      '%{count} classes have a selected student stuck on an item. Each gets more tries on the item they are stuck on.',
                  },
                  {count: stuck.length},
                ),
                confirmLabel: I18n.t('Give tries'),
                askAttempts: true,
                askReason: true,
              },
              run: start('extra_attempts', stuck, v => ({
                content_tag_id: 'current',
                attempts: v.attempts,
                reason: v.reason,
              })),
            }),
          stuck.length === 0,
        )}
        {items &&
          itemActions.length > 0 &&
          button(I18n.t('Item action'), () =>
            setDialog({
              spec: {
                title: I18n.t(
                  {
                    one: 'Act on an item for 1 student',
                    other: 'Act on an item for %{count} students',
                  },
                  {count},
                ),
                explanation: I18n.t(
                  'Exempting a graded item also excuses it, which needs permission to grade.',
                ),
                confirmLabel: I18n.t('Apply'),
                askItem: {
                  items: items.map(item => ({id: item.id, label: item.title, group: item.module})),
                  actions: itemActions,
                },
                askReason: true,
              },
              run: values =>
                start(values.action, perStudent, v => ({
                  content_tag_id: v.itemId,
                  reason: v.reason,
                  ...(v.action === 'extra_attempts' ? {attempts: v.attempts} : {}),
                }))(values),
            }),
          )}
        <span style={{flex: 1}} />
        {button(I18n.t('Clear selection'), () => {
          setResult(null)
          onClear()
        })}
        {result && (
          <div role="status" style={{flexBasis: '100%', padding: '4px 0', opacity: 0.92}}>
            {result}
          </div>
        )}
      </div>
      <ActionDialog
        spec={dialog?.spec ?? null}
        onSubmit={values => (dialog ? dialog.run(values) : Promise.resolve())}
        onClose={() => setDialog(null)}
      />
    </>
  )
}

function summarize(result: BulkResult): string {
  const done = I18n.t(
    {one: 'Done for 1 student.', other: 'Done for %{count} students.'},
    {count: result.done},
  )
  if (result.failed.length === 0) return done
  const names = result.failed
    .map(failure =>
      I18n.t('%{name} (%{error})', {
        name: failure.name ?? failure.student_id,
        error: failure.error,
      }),
    )
    .join(', ')
  return `${done} ${I18n.t('Not done for: %{names}.', {names})}`
}
