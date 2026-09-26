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

import React, {useEffect, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {Tray} from '@instructure/ui-tray'
import {CloseButton} from '@instructure/ui-buttons'
import {Spinner} from '@instructure/ui-spinner'
import {Text} from '@instructure/ui-text'
import ActionDialog, {type DialogSpec, type DialogValues} from './ActionDialog'
import ActivityBars from './ActivityBars'
import PacingSection from './PacingSection'
import {HistoryCard, ItemMenu, NotesCard, useSupport} from './Support'
import {overrideLabel, type ItemAction} from './interventions'
import {ScreenReaderContent, StatusShape, StudentAvatar} from './bits'
import {INK, tint} from './colors'
import {fillTemplate, formatDuration, formatPercent} from './format'
import {appBarBackground, Card, Pill, ROBOTO, SURFACE} from './material'
import type {
  CourseRef,
  DetailItem,
  Link,
  Note,
  RowKey,
  StudentDetail,
  TimelineEvent,
  Tools,
} from './types'

const I18n = createI18nScope('self_paced_dashboard')

const STATUS_LABELS = {
  working: () => I18n.t('Working'),
  idle: () => I18n.t('Idle'),
  away: () => I18n.t('Away'),
}

type Props = {
  selected: RowKey | null
  studentUrl: string
  pacingUrl: string
  studentPacingUrl: string
  interventionsUrl?: string | null // template; set when interventions are on
  // other pages about the student, linked from the header
  links?: (detail: StudentDetail) => Link[]
  colors: Record<string, string>
  classes: CourseRef[] // every class the student is in, to switch between
  onSelectClass: (courseId: string) => void
  onClose: () => void
  onPacingChanged: () => void
}

export default function StudentTray({
  selected,
  studentUrl,
  pacingUrl,
  studentPacingUrl,
  interventionsUrl,
  links,
  colors,
  classes,
  onSelectClass,
  onClose,
  onPacingChanged,
}: Props) {
  const [detail, setDetail] = useState<StudentDetail | null>(null)
  const [error, setError] = useState(false)
  // bumped after an intervention so the details reload in place
  const [reloadKey, setReloadKey] = useState(0)
  const {support, perform} = useSupport(interventionsUrl, selected)
  const [dialog, setDialog] = useState<{
    spec: DialogSpec
    run: (values: DialogValues) => Promise<void>
  } | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    setDialog(null)
    setAnnouncement('')
    setDetail(null)
  }, [selected])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setError(false)
    doFetchApi<StudentDetail>({
      path: fillTemplate(studentUrl, {
        course_id: selected.courseId,
        student_id: selected.studentId,
      }),
    })
      .then(({json}) => {
        if (!cancelled && json) setDetail(json)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [selected, studentUrl, reloadKey])

  // Runs an intervention from a dialog, then refreshes the tray and roster.
  const act = async (body: Record<string, unknown>, done: string) => {
    await perform(body)
    setDialog(null)
    setAnnouncement(done)
    setReloadKey(key => key + 1)
    onPacingChanged()
  }

  const chooseItemAction = (item: DetailItem, action: ItemAction) =>
    setDialog({
      spec: {
        title: I18n.t('%{action}: %{title}', {action: action.label, title: item.title}),
        explanation: action.explanation,
        confirmLabel: action.label,
        askAttempts: action.askAttempts,
        askReason: true,
      },
      run: values =>
        act(
          {
            kind: action.kind,
            content_tag_id: item.id,
            override_kind: action.overrideKind,
            reason: values.reason,
            ...(action.askAttempts ? {attempts: values.attempts} : {}),
          },
          I18n.t('Done: %{action}, %{title}.', {action: action.label, title: item.title}),
        ),
    })

  const name = detail?.student.name ?? ''
  const tools = support?.tools

  const openMessage = () =>
    setDialog({
      spec: {
        title: I18n.t('Message %{name}', {name}),
        confirmLabel: I18n.t('Send'),
        askSubject: true,
        askBody: {label: I18n.t('Message')},
      },
      run: values =>
        act(
          {kind: 'message', subject: values.subject, body: values.body},
          I18n.t('Message sent to %{name}.', {name}),
        ),
    })

  const openNote = () =>
    setDialog({
      spec: {
        title: I18n.t('Add a note about %{name}', {name}),
        confirmLabel: I18n.t('Save note'),
        askBody: {label: I18n.t('Note')},
      },
      run: values => act({kind: 'note', body: values.body}, I18n.t('Note saved.')),
    })

  const confirmDeleteNote = (note: Note) =>
    setDialog({
      spec: {
        title: I18n.t('Delete this note?'),
        explanation: note.body,
        confirmLabel: I18n.t('Delete'),
      },
      run: () => act({kind: 'delete_note', note_id: note.id}, I18n.t('Note deleted.')),
    })

  const color = (selected && colors[selected.courseId]) || '#37474f'

  return (
    <Tray
      label={
        detail ? I18n.t('%{name} details', {name: detail.student.name}) : I18n.t('Student details')
      }
      open={!!selected}
      onDismiss={onClose}
      placement="end"
      size="medium"
      shouldCloseOnDocumentClick={true}
    >
      <div
        className="self-paced-page"
        style={{position: 'relative', minHeight: '100vh', background: SURFACE, fontFamily: ROBOTO}}
      >
        <div style={{position: 'absolute', top: 8, right: 8, zIndex: 1}}>
          <CloseButton
            color={detail ? 'primary-inverse' : 'primary'}
            screenReaderLabel={I18n.t('Close')}
            onClick={onClose}
          />
        </div>
        {error && (
          <div style={{padding: '56px 16px 16px'}}>
            <Text color="danger">
              {I18n.t("This student's details didn't load. Close the panel and try again.")}
            </Text>
          </div>
        )}
        {!error && !detail && (
          <div style={{textAlign: 'center', padding: '64px 16px'}}>
            <Spinner renderTitle={I18n.t('Loading student details')} />
          </div>
        )}
        {detail && selected && (
          <DetailBody
            detail={detail}
            color={color}
            classes={classes}
            onSelectClass={onSelectClass}
            tools={tools}
            onItemAction={chooseItemAction}
            onMessage={tools?.message ? openMessage : undefined}
            links={links?.(detail) ?? []}
            after={support ? <HistoryCard log={support.log} color={color} /> : null}
          >
            <PacingSection
              courseId={selected.courseId}
              studentId={selected.studentId}
              pacingUrl={pacingUrl}
              studentPacingUrl={studentPacingUrl}
              color={color}
              onChanged={() => {
                onPacingChanged()
                setReloadKey(key => key + 1)
              }}
            />
            {tools?.note && support && (
              <NotesCard notes={support.notes} onAdd={openNote} onDelete={confirmDeleteNote} />
            )}
          </DetailBody>
        )}
        <div aria-live="polite" role="status">
          <ScreenReaderContent>{announcement}</ScreenReaderContent>
        </div>
        <ActionDialog
          spec={dialog?.spec ?? null}
          onSubmit={values => (dialog ? dialog.run(values) : Promise.resolve())}
          onClose={() => setDialog(null)}
        />
      </div>
    </Tray>
  )
}

function DetailBody({
  detail,
  color,
  classes = [],
  onSelectClass,
  tools,
  onItemAction,
  onMessage,
  links = [],
  after,
  children,
}: {
  detail: StudentDetail
  color: string
  classes?: CourseRef[]
  onSelectClass?: (courseId: string) => void
  tools?: Tools
  onItemAction?: (item: DetailItem, action: ItemAction) => void
  onMessage?: () => void
  links?: Link[]
  after?: React.ReactNode
  children?: React.ReactNode
}) {
  const percent = Math.max(0, Math.min(100, detail.percent_complete))
  return (
    <>
      {/* the student's header, in their course's color like the course map */}
      <header
        style={{background: appBarBackground(color), color: '#fff', padding: '32px 24px 20px'}}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 16, paddingRight: 32}}>
          <span
            style={{borderRadius: '50%', background: '#fff', display: 'inline-flex', flexShrink: 0}}
          >
            <StudentAvatar
              name={detail.student.name}
              color={color}
              size={64}
              status={detail.status}
            />
          </span>
          <div style={{minWidth: 0}}>
            <h2
              style={{
                margin: 0,
                fontFamily: ROBOTO,
                fontWeight: 300,
                fontSize: '1.75rem',
                lineHeight: 1.2,
                color: '#fff',
                overflowWrap: 'anywhere',
              }}
            >
              {detail.student.name}
            </h2>
            {classes.length <= 1 && (
              <div style={{marginTop: 4, opacity: 0.92}}>{detail.course.name}</div>
            )}
            {links.length > 0 && (
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6}}>
                {links.map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    style={{color: '#fff', fontWeight: 500, textDecoration: 'underline'}}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {classes.length > 1 && (
          // one chip per class; the details below are for the chosen one
          <div
            role="group"
            aria-label={I18n.t('Classes')}
            style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16}}
          >
            {classes.map(course => {
              const current = course.id === detail.course.id
              return (
                <button
                  key={course.id}
                  type="button"
                  aria-pressed={current}
                  onClick={() => onSelectClass?.(course.id)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.7)',
                    background: current ? '#fff' : 'transparent',
                    color: current ? INK.primary : '#fff',
                    fontFamily: ROBOTO,
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {course.name}
                </button>
              )
            })}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            margin: '16px 0 12px',
          }}
        >
          {detail.status && (
            <Pill background="#fff">
              <StatusShape status={detail.status} size={10} />
              {STATUS_LABELS[detail.status]()}
            </Pill>
          )}
          {onMessage && (
            // a raised white Material button on the course-colored header
            <button
              type="button"
              onClick={onMessage}
              style={{
                marginLeft: 'auto',
                padding: '6px 16px',
                borderRadius: 2,
                border: 'none',
                background: '#fff',
                color: INK.primary,
                fontFamily: ROBOTO,
                fontSize: '0.8125rem',
                fontWeight: 500,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                cursor: 'pointer',
              }}
            >
              {I18n.t('Message')}
            </button>
          )}
        </div>
        <div
          role="meter"
          aria-label={I18n.t('Course progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          style={{height: 4, background: 'rgba(255,255,255,0.35)'}}
        >
          <div style={{width: `${percent}%`, height: '100%', background: '#fff'}} />
        </div>
        <div style={{marginTop: 8, fontSize: '0.875rem'}}>
          {I18n.t('%{percent} done, %{done} of %{total} requirements', {
            percent: formatPercent(percent),
            done: detail.requirements_completed,
            total: detail.requirements_total,
          })}
        </div>
      </header>

      <div style={{padding: 16}}>
        {children}

        <Card
          level={3}
          title={I18n.t('Active time, last 4 weeks')}
          labelledBy="self-paced-tray-activity"
        >
          <ActivityBars days={detail.activity} color={color} />
        </Card>

        <Card level={3} title={I18n.t('Time on each item')} labelledBy="self-paced-tray-items">
          <ItemList
            items={detail.items}
            currentItemId={detail.current_item_id}
            color={color}
            tools={tools}
            onItemAction={onItemAction}
          />
        </Card>

        <Card level={3} title={I18n.t('Attempts')} labelledBy="self-paced-tray-attempts">
          {detail.attempts.length === 0 ? (
            <span style={{color: INK.secondary}}>{I18n.t('No submissions yet.')}</span>
          ) : (
            <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
              {detail.attempts.map(assignment => (
                <li
                  key={assignment.assignment_id}
                  style={{padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.12)'}}
                >
                  <div style={{fontWeight: 500}}>{assignment.title}</div>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8}}>
                    {assignment.attempts.map(attempt => (
                      <Pill key={attempt.attempt} background={tint(color, 0.14)}>
                        <span style={{fontVariantNumeric: 'tabular-nums', fontWeight: 400}}>
                          {detail.grades_visible &&
                          attempt.score !== null &&
                          assignment.points_possible
                            ? I18n.t('Try %{n}: %{score} / %{possible}', {
                                n: attempt.attempt,
                                score: attempt.score,
                                possible: assignment.points_possible,
                              })
                            : I18n.t('Try %{n}', {n: attempt.attempt})}
                        </span>
                      </Pill>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card level={3} title={I18n.t('Recent activity')} labelledBy="self-paced-tray-timeline">
          <Timeline events={detail.timeline} gradesVisible={detail.grades_visible} color={color} />
        </Card>

        {after}
      </div>
    </>
  )
}

// Every module item in course order. Bars compare items with each other, so
// the longest item is the full width.
function ItemList({
  items,
  currentItemId,
  color,
  tools,
  onItemAction,
}: {
  items: DetailItem[]
  currentItemId: string | null
  color: string
  tools?: Tools
  onItemAction?: (item: DetailItem, action: ItemAction) => void
}) {
  if (items.length === 0)
    return <span style={{color: INK.secondary}}>{I18n.t('This course has no module items.')}</span>
  const max = Math.max(60, ...items.map(i => i.active_seconds))
  let lastModule: string | null = null
  return (
    <div style={{maxHeight: '22rem', overflowY: 'auto', margin: '0 -8px'}}>
      <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
        {items.map(item => {
          const showModule = item.module !== lastModule
          lastModule = item.module
          const isCurrent = item.id === currentItemId
          return (
            <li key={item.id}>
              {showModule && (
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: INK.secondary,
                    padding: '12px 8px 4px',
                  }}
                >
                  {item.module}
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    tools && onItemAction ? '1.5rem 1fr 5.5rem 2rem' : '1.5rem 1fr 5.5rem',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 2,
                  background: isCurrent ? tint(color, 0.12) : 'transparent',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: item.completed ? color : 'transparent',
                    boxShadow: item.completed ? 'none' : `inset 0 0 0 2px ${tint(color, 0.45)}`,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {item.completed ? '✓' : ''}
                </span>
                <span style={{minWidth: 0}}>
                  <span
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: isCurrent ? 500 : 400,
                    }}
                  >
                    {item.title}
                    {isCurrent && (
                      <span style={{color: INK.secondary, fontWeight: 400}}>
                        {' '}
                        ({I18n.t('on it now')})
                      </span>
                    )}
                  </span>
                  {(item.overrides ?? []).length > 0 && (
                    <span style={{display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2}}>
                      {(item.overrides ?? []).map(kind => (
                        <Pill key={kind} background={tint(color, 0.14)}>
                          {overrideLabel(kind)}
                        </Pill>
                      ))}
                    </span>
                  )}
                  <span
                    style={{
                      display: 'block',
                      height: 4,
                      marginTop: 4,
                      background: tint(color, 0.14),
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${(item.active_seconds / max) * 100}%`,
                        background: color,
                      }}
                    />
                  </span>
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: INK.secondary,
                    fontSize: '0.875rem',
                  }}
                >
                  {formatDuration(item.active_seconds)}
                  <ScreenReaderContent>
                    {item.completed ? I18n.t('completed') : I18n.t('not completed')}
                  </ScreenReaderContent>
                </span>
                {tools && onItemAction && (
                  <ItemMenu
                    item={item}
                    tools={tools}
                    onChoose={action => onItemAction(item, action)}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Newest first, on a trail like the course map's: a filled dot for a
// submission, a ring for time spent on a page.
function Timeline({
  events,
  gradesVisible,
  color,
}: {
  events: TimelineEvent[]
  gradesVisible: boolean
  color: string
}) {
  if (events.length === 0)
    return <span style={{color: INK.secondary}}>{I18n.t('Nothing yet.')}</span>
  return (
    <ol style={{listStyle: 'none', margin: 0, padding: 0}}>
      {events.map((event, index) => (
        <li
          key={`${event.kind}-${event.title}-${event.at}`}
          style={{display: 'grid', gridTemplateColumns: '14px 1fr', gap: 12, position: 'relative'}}
        >
          {index < events.length - 1 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 6,
                top: 18,
                bottom: -6,
                width: 2,
                background: tint(color, 0.3),
              }}
            />
          )}
          <span
            aria-hidden="true"
            style={{
              marginTop: 6,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: event.kind === 'submitted' ? color : '#fff',
              boxShadow: event.kind === 'submitted' ? 'none' : `inset 0 0 0 2px ${color}`,
              position: 'relative',
            }}
          />
          <div style={{padding: '2px 0 14px'}}>
            <div>
              {event.kind === 'submitted'
                ? gradesVisible && event.score !== null && event.points_possible
                  ? I18n.t('Submitted %{title} (try %{n}), scored %{score} / %{possible}', {
                      title: event.title,
                      n: event.attempt,
                      score: event.score,
                      possible: event.points_possible,
                    })
                  : I18n.t('Submitted %{title} (try %{n})', {title: event.title, n: event.attempt})
                : I18n.t('Worked on %{title} (%{duration} in total)', {
                    title: event.title,
                    duration: formatDuration(event.active_seconds),
                  })}
            </div>
            <div
              style={{color: INK.muted, fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums'}}
            >
              {new Date(event.at).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
