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

import React from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Heading} from '@instructure/ui-heading'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import {StatusShape, StudentAvatar, StuckBadge} from './bits'
import {INK} from './colors'
import {formatDuration, formatLastActive, secondsSince} from './format'
import type {RosterRow, RowKey, Status} from './types'

const I18n = createI18nScope('self_paced_dashboard')

type Props = {
  rows: RosterRow[]
  colors: Record<string, string>
  now: Date
  idleMinutes: number
  onOpenStudent: (key: RowKey) => void
}

// The room right now, like a seating chart: everyone working, then everyone
// idle, with the students who aren't here listed quietly underneath.
export default function LiveBoard({rows, colors, now, idleMinutes, onOpenStudent}: Props) {
  const withStatus = rows.filter(row => row.status)
  const group = (status: Status) =>
    withStatus
      .filter(row => row.status === status)
      .sort((a, b) => a.student.sortable_name.localeCompare(b.student.sortable_name))

  if (withStatus.length === 0) {
    return (
      <View as="div" padding="large 0">
        <Text color="secondary">
          {I18n.t(
            "Live status isn't available for these courses. Ask an admin for the live monitor permission.",
          )}
        </Text>
      </View>
    )
  }

  const working = group('working')
  const idle = group('idle')
  const away = group('away')

  return (
    <View as="div" padding="small 0">
      <Section
        status="working"
        title={I18n.t('Working now')}
        empty={I18n.t('Nobody is working right now.')}
        rows={working}
        colors={colors}
        now={now}
        onOpenStudent={onOpenStudent}
      />
      <Section
        status="idle"
        title={I18n.t('Idle for %{minutes}+ minutes', {minutes: idleMinutes})}
        empty={I18n.t('Nobody is idle.')}
        rows={idle}
        colors={colors}
        now={now}
        onOpenStudent={onOpenStudent}
      />
      <View as="section" margin="large 0 0">
        <Heading level="h3" margin="0 0 small">
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
            <StatusShape status="away" size={12} />
            {I18n.t('Away (%{count})', {count: away.length})}
          </span>
        </Heading>
        {away.length === 0 ? (
          <Text color="secondary">{I18n.t('Everyone is here.')}</Text>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px 20px',
            }}
          >
            {away.map(row => (
              <li key={`${row.course.id}-${row.student.id}`}>
                <button
                  type="button"
                  onClick={() =>
                    onOpenStudent({courseId: row.course.id, studentId: row.student.id})
                  }
                  style={{
                    background: 'none',
                    border: 0,
                    padding: '4px 0',
                    cursor: 'pointer',
                    color: INK.secondary,
                    font: 'inherit',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      marginRight: 6,
                      background: colors[row.course.id],
                    }}
                  />
                  {row.student.name}
                  <span style={{color: INK.muted}}>
                    {' '}
                    ({formatLastActive(row.last_active_at, now)})
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </View>
    </View>
  )
}

function Section({
  status,
  title,
  empty,
  rows,
  colors,
  now,
  onOpenStudent,
}: {
  status: Status
  title: string
  empty: string
  rows: RosterRow[]
  colors: Record<string, string>
  now: Date
  onOpenStudent: (key: RowKey) => void
}) {
  return (
    <View as="section" margin="medium 0 0">
      <Heading level="h3" margin="0 0 small">
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
          <StatusShape status={status} size={12} />
          {title} <span style={{color: INK.muted, fontWeight: 400}}>({rows.length})</span>
        </span>
      </Heading>
      {rows.length === 0 ? (
        <Text color="secondary">{empty}</Text>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))',
            gap: '20px 12px',
          }}
        >
          {rows.map(row => (
            <li key={`${row.course.id}-${row.student.id}`}>
              <Seat
                row={row}
                color={colors[row.course.id]}
                now={now}
                onOpenStudent={onOpenStudent}
              />
            </li>
          ))}
        </ul>
      )}
    </View>
  )
}

function Seat({
  row,
  color,
  now,
  onOpenStudent,
}: {
  row: RosterRow
  color: string
  now: Date
  onOpenStudent: (key: RowKey) => void
}) {
  const minutesOnItem = secondsSince(row.viewing_since, now)
  return (
    <button
      type="button"
      className="self-paced-seat"
      onClick={() => onOpenStudent({courseId: row.course.id, studentId: row.student.id})}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '12px 8px',
        background: 'none',
        border: 0,
        borderRadius: 2,
        cursor: 'pointer',
        font: 'inherit',
        color: INK.primary,
        textAlign: 'center',
      }}
    >
      <StudentAvatar name={row.student.name} color={color} size={64} status={row.status} />
      <span style={{fontWeight: 500, lineHeight: 1.25}}>{row.student.name}</span>
      <span
        style={{
          fontSize: '0.8125rem',
          color: INK.secondary,
          lineHeight: 1.3,
          maxWidth: '100%',
          overflowWrap: 'anywhere',
        }}
      >
        {row.viewing ? row.viewing.title : I18n.t('Course pages')}
      </span>
      <span style={{fontSize: '0.8125rem', color: INK.muted, fontVariantNumeric: 'tabular-nums'}}>
        {I18n.t('%{duration} on this page', {duration: formatDuration(minutesOnItem)})}
      </span>
      <StuckBadge attempts={row.attempts_on_current_item} />
    </button>
  )
}
