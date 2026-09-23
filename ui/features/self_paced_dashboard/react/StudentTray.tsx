/*
 * Copyright (C) 2026 - present EXAMPLE contributors
 *
 * This file is part of EXAMPLE LMS, a modified version of Canvas.
 *
 * EXAMPLE LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
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
import {Heading} from '@instructure/ui-heading'
import {Spinner} from '@instructure/ui-spinner'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import ActivityBars from './ActivityBars'
import {CourseChip, ProgressMeter, ScreenReaderContent, StatusBadge, StudentAvatar} from './bits'
import {INK, tint} from './colors'
import {fillTemplate, formatDuration} from './format'
import type {DetailItem, RowKey, StudentDetail, TimelineEvent} from './types'

const I18n = createI18nScope('self_paced_dashboard')

type Props = {
  selected: RowKey | null
  studentUrl: string
  colors: Record<string, string>
  onClose: () => void
}

export default function StudentTray({selected, studentUrl, colors, onClose}: Props) {
  const [detail, setDetail] = useState<StudentDetail | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setDetail(null)
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
  }, [selected, studentUrl])

  const color = selected ? colors[selected.courseId] : INK.muted

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
      <View as="div" padding="medium" position="relative">
        <CloseButton
          placement="end"
          offset="small"
          screenReaderLabel={I18n.t('Close')}
          onClick={onClose}
        />
        {error && (
          <Text color="danger">
            {I18n.t("This student's details didn't load. Close the panel and try again.")}
          </Text>
        )}
        {!error && !detail && (
          <View as="div" textAlign="center" padding="large">
            <Spinner renderTitle={I18n.t('Loading student details')} />
          </View>
        )}
        {detail && <DetailBody detail={detail} color={color} />}
      </View>
    </Tray>
  )
}

function DetailBody({detail, color}: {detail: StudentDetail; color: string}) {
  return (
    <>
      <div style={{display: 'flex', alignItems: 'center', gap: 16, paddingRight: 40}}>
        <StudentAvatar name={detail.student.name} color={color} size={56} status={detail.status} />
        <div style={{minWidth: 0}}>
          <Heading level="h2" margin="0">
            {detail.student.name}
          </Heading>
          <div style={{marginTop: 4, color: INK.secondary}}>
            <CourseChip name={detail.course.name} color={color} />
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 24px',
          alignItems: 'center',
          margin: '20px 0 8px',
        }}
      >
        <StatusBadge status={detail.status} />
        <ProgressMeter
          percent={detail.percent_complete}
          color={color}
          width={140}
          label={I18n.t('Course progress')}
        />
        <Text color="secondary" size="small">
          {I18n.t('%{done} of %{total} requirements', {
            done: detail.requirements_completed,
            total: detail.requirements_total,
          })}
        </Text>
      </div>

      <Heading level="h3" margin="large 0 x-small">
        {I18n.t('Active time, last 4 weeks')}
      </Heading>
      <ActivityBars days={detail.activity} color={color} />

      <Heading level="h3" margin="large 0 small">
        {I18n.t('Time on each item')}
      </Heading>
      <ItemList items={detail.items} currentItemId={detail.current_item_id} color={color} />

      <Heading level="h3" margin="large 0 small">
        {I18n.t('Attempts')}
      </Heading>
      {detail.attempts.length === 0 ? (
        <Text color="secondary">{I18n.t('No submissions yet.')}</Text>
      ) : (
        <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
          {detail.attempts.map(assignment => (
            <li
              key={assignment.assignment_id}
              style={{padding: '8px 0', borderBottom: `1px solid ${INK.hairline}`}}
            >
              <div style={{fontWeight: 500}}>{assignment.title}</div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6}}>
                {assignment.attempts.map(attempt => (
                  <span
                    key={attempt.attempt}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 2,
                      background: tint(color, 0.12),
                      fontSize: '0.8125rem',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {detail.grades_visible && attempt.score !== null && assignment.points_possible
                      ? I18n.t('Try %{n}: %{score} / %{possible}', {
                          n: attempt.attempt,
                          score: attempt.score,
                          possible: assignment.points_possible,
                        })
                      : I18n.t('Try %{n}', {n: attempt.attempt})}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Heading level="h3" margin="large 0 small">
        {I18n.t('Recent activity')}
      </Heading>
      <Timeline events={detail.timeline} gradesVisible={detail.grades_visible} />
    </>
  )
}

// Every module item in course order. Bars compare items with each other, so
// the longest item is the full width.
function ItemList({
  items,
  currentItemId,
  color,
}: {
  items: DetailItem[]
  currentItemId: string | null
  color: string
}) {
  if (items.length === 0)
    return <Text color="secondary">{I18n.t('This course has no module items.')}</Text>
  const max = Math.max(60, ...items.map(i => i.active_seconds))
  let lastModule: string | null = null
  return (
    <div style={{maxHeight: '22rem', overflowY: 'auto'}}>
      <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
        {items.map(item => {
          const showModule = item.module !== lastModule
          lastModule = item.module
          const isCurrent = item.id === currentItemId
          return (
            <li key={item.id}>
              {showModule && (
                <div style={{fontSize: '0.8125rem', color: INK.muted, margin: '12px 0 4px'}}>
                  {item.module}
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.25rem 1fr 5.5rem',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 6px',
                  borderRadius: 2,
                  background: isCurrent ? tint(color, 0.12) : 'transparent',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{color: item.completed ? color : INK.muted, fontWeight: 700}}
                >
                  {item.completed ? '✓' : '○'}
                </span>
                <span style={{minWidth: 0}}>
                  <span
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                    {isCurrent && (
                      <span style={{color: INK.secondary}}> ({I18n.t('on it now')})</span>
                    )}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      height: 4,
                      marginTop: 3,
                      borderRadius: 2,
                      background: tint(color, 0.14),
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${(item.active_seconds / max) * 100}%`,
                        borderRadius: 2,
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
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Timeline({events, gradesVisible}: {events: TimelineEvent[]; gradesVisible: boolean}) {
  if (events.length === 0) return <Text color="secondary">{I18n.t('Nothing yet.')}</Text>
  return (
    <ol style={{listStyle: 'none', margin: 0, padding: 0}}>
      {events.map(event => (
        <li
          key={`${event.kind}-${event.title}-${event.at}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '8.5rem 1fr',
            gap: 12,
            padding: '6px 0',
            borderBottom: `1px solid ${INK.hairline}`,
          }}
        >
          <span
            style={{color: INK.muted, fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums'}}
          >
            {new Date(event.at).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
          <span>
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
          </span>
        </li>
      ))}
    </ol>
  )
}
