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
import {Button} from '@instructure/ui-buttons'
import {useScope as createI18nScope} from '@canvas/i18n'
import {CourseChip, StatusShape, StudentAvatar, StuckBadge} from './bits'
import {INK, tint} from './colors'
import {formatDuration, formatLastActive, secondsSince} from './format'
import {Card, ELEVATION, Pill, ROBOTO} from './material'
import {groupByStudent} from './grouping'
import type {RosterRow, RowKey, Status} from './types'

type LiveRow = RosterRow & {class_count: number}

// Away students shown before "Show all", so a big school doesn't bury the page.
const AWAY_SHOWN = 40

const I18n = createI18nScope('self_paced_dashboard')

type Props = {
  rows: RosterRow[]
  colors: Record<string, string>
  now: Date
  idleMinutes: number
  onOpenStudent: (key: RowKey) => void
}

// The room right now, like a seating chart: everyone working, then everyone
// idle, with the students who aren't here as chips underneath.
export default function LiveBoard({rows, colors, now, idleMinutes, onOpenStudent}: Props) {
  const [allAway, setAllAway] = useState(false)
  // One seat per student: the class they're in now, their most tries anywhere,
  // and how many classes they take.
  const withStatus: LiveRow[] = groupByStudent(rows)
    .map(group => ({
      ...group.primary,
      attempts_on_current_item: group.summary.attempts_on_current_item,
      class_count: group.rows.length,
    }))
    .filter(row => row.status)
  const group = (status: Status) =>
    withStatus
      .filter(row => row.status === status)
      .sort((a, b) => a.student.sortable_name.localeCompare(b.student.sortable_name))

  if (withStatus.length === 0) {
    return (
      <Card>
        <div style={{paddingTop: 16, color: INK.secondary}}>
          {I18n.t(
            "Live status isn't available for these courses. Ask an admin for the live monitor permission.",
          )}
        </div>
      </Card>
    )
  }

  const working = group('working')
  const idle = group('idle')
  const away = group('away')

  return (
    <div>
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
      <Card
        labelledBy="self-paced-live-away"
        title={
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
            <StatusShape status="away" size={12} />
            {I18n.t('Away (%{count})', {count: away.length})}
          </span>
        }
      >
        {away.length === 0 ? (
          <span style={{color: INK.secondary}}>{I18n.t('Everyone is here.')}</span>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {(allAway ? away : away.slice(0, AWAY_SHOWN)).map(row => (
              <li key={`${row.course.id}-${row.student.id}`}>
                {/* a Material chip: the student's initials, name and when they were last here */}
                <button
                  type="button"
                  className="self-paced-chip"
                  onClick={() =>
                    onOpenStudent({courseId: row.course.id, studentId: row.student.id})
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 12px 0 0',
                    height: 32,
                    borderRadius: 16,
                    border: 0,
                    background: '#e0e0e0',
                    cursor: 'pointer',
                    fontFamily: ROBOTO,
                    fontSize: '0.8125rem',
                    color: INK.primary,
                  }}
                >
                  <StudentAvatar name={row.student.name} color={colors[row.course.id]} size={32} />
                  {row.student.name}{' '}
                  <span style={{color: INK.secondary}}>
                    ({formatLastActive(row.last_active_at, now)})
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {away.length > AWAY_SHOWN && (
          <div style={{marginTop: 12}}>
            <Button
              size="small"
              color="primary"
              withBackground={false}
              onClick={() => setAllAway(!allAway)}
            >
              {allAway ? I18n.t('Show fewer') : I18n.t('Show all %{count}', {count: away.length})}
            </Button>
          </div>
        )}
      </Card>
    </div>
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
  rows: LiveRow[]
  colors: Record<string, string>
  now: Date
  onOpenStudent: (key: RowKey) => void
}) {
  return (
    <section aria-labelledby={`self-paced-live-${status}`} style={{margin: '0 0 24px'}}>
      <h2
        id={`self-paced-live-${status}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          margin: '0 0 12px',
          fontFamily: ROBOTO,
          fontSize: '1rem',
          fontWeight: 500,
          color: INK.primary,
        }}
      >
        <StatusShape status={status} size={12} />
        {title} <Pill>{rows.length}</Pill>
      </h2>
      {rows.length === 0 ? (
        <span style={{color: INK.secondary}}>{empty}</span>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(10.5rem, 1fr))',
            gap: 16,
          }}
        >
          {rows.map(row => (
            <li key={`${row.course.id}-${row.student.id}`} style={{display: 'flex'}}>
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
    </section>
  )
}

// One student as a card, with a strip of their course's color along the top.
function Seat({
  row,
  color,
  now,
  onOpenStudent,
}: {
  row: LiveRow
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
        padding: '0 12px 16px',
        background: '#FFFFFF',
        border: 0,
        borderRadius: 2,
        boxShadow: ELEVATION[2],
        overflow: 'hidden',
        cursor: 'pointer',
        fontFamily: ROBOTO,
        color: INK.primary,
        textAlign: 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          alignSelf: 'stretch',
          height: 40,
          margin: '0 -12px 8px',
          background: `linear-gradient(${color}, ${color}) top / 100% 4px no-repeat, ${tint(color, 0.14)}`,
        }}
      />
      <span
        style={{marginTop: -40, borderRadius: '50%', background: '#fff', display: 'inline-flex'}}
      >
        <StudentAvatar name={row.student.name} color={color} size={64} status={row.status} />
      </span>
      <span style={{fontWeight: 500, lineHeight: 1.25, marginTop: 4}}>{row.student.name}</span>
      <span style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem'}}>
        <CourseChip name={row.course.name} color={color} />
        {row.class_count > 1 && (
          <Pill>{I18n.t('+%{count} more', {count: row.class_count - 1})}</Pill>
        )}
      </span>
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
