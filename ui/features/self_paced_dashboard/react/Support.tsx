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

import React, {useCallback, useEffect, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {Button, IconButton} from '@instructure/ui-buttons'
import {IconMoreLine} from '@instructure/ui-icons'
import {Menu} from '@instructure/ui-menu'
import {INK, tint} from './colors'
import {fillTemplate} from './format'
import {describeEntry, errorMessage, itemActions, type ItemAction} from './interventions'
import {Card, DIVIDER, Pill} from './material'
import type {DetailItem, InterventionKind, LogEntry, Note, RowKey, Support, Tools} from './types'

const I18n = createI18nScope('self_paced_dashboard')

// The viewer's tools, the history and the notes for the open student, plus a
// way to run an intervention and reload them.
export function useSupport(url: string | null | undefined, selected: RowKey | null) {
  const [support, setSupport] = useState<Support | null>(null)

  const path =
    url && selected
      ? fillTemplate(url, {course_id: selected.courseId, student_id: selected.studentId})
      : null

  const reload = useCallback(() => {
    if (!path) return Promise.resolve()
    return doFetchApi<Support>({path})
      .then(({json}) => setSupport(json ?? null))
      .catch(() => setSupport(null))
  }, [path])

  useEffect(() => {
    setSupport(null)
    reload()
  }, [reload])

  // Runs an intervention; throws with the server's explanation when refused.
  const perform = useCallback(
    async (body: Record<string, unknown>) => {
      if (!path) return
      try {
        await doFetchApi({path, method: 'POST', body})
      } catch (e) {
        throw new Error(
          (await errorMessage(e)) ??
            I18n.t("That didn't work. Check your connection and try again."),
        )
      }
      await reload()
    },
    [path, reload],
  )

  return {support, perform}
}

// The "more" button beside an item in the tray, with what can be done to it.
export function ItemMenu({
  item,
  tools,
  onChoose,
}: {
  item: DetailItem
  tools: Tools
  onChoose: (action: ItemAction) => void
}) {
  const actions = itemActions(item, tools)
  if (actions.length === 0) return <span />
  return (
    <Menu
      placement="bottom end"
      trigger={
        <IconButton
          size="small"
          withBackground={false}
          withBorder={false}
          renderIcon={<IconMoreLine />}
          screenReaderLabel={I18n.t('Actions for %{title}', {title: item.title})}
        />
      }
    >
      {actions.map(action => (
        <Menu.Item
          key={`${action.kind}-${action.overrideKind ?? ''}`}
          onSelect={() => onChoose(action)}
        >
          {action.label}
        </Menu.Item>
      ))}
    </Menu>
  )
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Staff-only notes about the student, from any of their classes.
export function NotesCard({
  notes,
  onAdd,
  onDelete,
}: {
  notes: Note[]
  onAdd: () => void
  onDelete: (note: Note) => void
}) {
  return (
    <Card
      level={3}
      title={I18n.t('Notes')}
      labelledBy="self-paced-tray-notes"
      aside={
        <Button size="small" color="primary" withBackground={false} onClick={onAdd}>
          {I18n.t('Add note')}
        </Button>
      }
    >
      <p style={{margin: '0 0 8px', color: INK.muted, fontSize: '0.8125rem'}}>
        {I18n.t('Only staff can see notes.')}
      </p>
      {notes.length === 0 ? (
        <span style={{color: INK.secondary}}>{I18n.t('No notes yet.')}</span>
      ) : (
        <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
          {notes.map(note => (
            <li key={note.id} style={{padding: '10px 0', borderTop: `1px solid ${DIVIDER}`}}>
              <div style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{note.body}</div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 4,
                  color: INK.muted,
                  fontSize: '0.8125rem',
                }}
              >
                <span>
                  {note.course
                    ? I18n.t('%{author}, %{course}, %{when}', {
                        author: note.author.name,
                        course: note.course.name,
                        when: when(note.created_at),
                      })
                    : I18n.t('%{author}, %{when}', {
                        author: note.author.name,
                        when: when(note.created_at),
                      })}
                </span>
                {note.can_delete && (
                  <Button size="small" withBackground={false} onClick={() => onDelete(note)}>
                    {I18n.t('Delete')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const KIND_MARKS: Partial<Record<InterventionKind, string>> = {
  note: '✎',
  delete_note: '✎',
  message: '✉',
  adjust_target: '⏱',
}

// What staff have done for the student in this class, newest first.
export function HistoryCard({log, color}: {log: LogEntry[]; color: string}) {
  return (
    <Card level={3} title={I18n.t('Help given')} labelledBy="self-paced-tray-history">
      {log.length === 0 ? (
        <span style={{color: INK.secondary}}>
          {I18n.t('Nothing yet. Unlocks, extra tries, notes and messages show up here.')}
        </span>
      ) : (
        <ol style={{listStyle: 'none', margin: 0, padding: 0}}>
          {log.map(entry => (
            <li
              key={entry.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr',
                gap: 12,
                padding: '8px 0',
                borderTop: `1px solid ${DIVIDER}`,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: tint(color, 0.14),
                  color: INK.primary,
                  fontSize: 12,
                }}
              >
                {KIND_MARKS[entry.kind] ?? '✓'}
              </span>
              <div>
                <div>{describeEntry(entry)}</div>
                {entry.reason && (
                  <div
                    style={{color: INK.secondary, fontStyle: 'italic', overflowWrap: 'anywhere'}}
                  >
                    {entry.reason}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                    color: INK.muted,
                    fontSize: '0.8125rem',
                  }}
                >
                  <span>
                    {entry.real_actor
                      ? I18n.t('%{actor} (by %{real}), %{when}', {
                          actor: entry.actor.name,
                          real: entry.real_actor.name,
                          when: when(entry.created_at),
                        })
                      : I18n.t('%{actor}, %{when}', {
                          actor: entry.actor.name,
                          when: when(entry.created_at),
                        })}
                  </span>
                  {entry.bulk && <Pill>{I18n.t('Bulk')}</Pill>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
