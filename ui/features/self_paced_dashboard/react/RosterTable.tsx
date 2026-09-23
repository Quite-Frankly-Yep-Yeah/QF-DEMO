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

import React, {useMemo, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Table} from '@instructure/ui-table'
import {Link} from '@instructure/ui-link'
import {Text} from '@instructure/ui-text'
import {
  CourseChip,
  PinButton,
  ProgressMeter,
  ScreenReaderContent,
  StatusBadge,
  StuckBadge,
} from './bits'
import {INK} from './colors'
import {formatDuration, formatLastActive, formatScore, isStuck} from './format'
import type {RosterRow, RowKey, Status} from './types'

const I18n = createI18nScope('self_paced_dashboard')

export type SortKey =
  | 'student'
  | 'course'
  | 'status'
  | 'working_on'
  | 'progress'
  | 'score'
  | 'last_active'
  | 'today'
  | 'week'
  | 'attempts'

type Direction = 'ascending' | 'descending'

const STATUS_ORDER: Record<Status, number> = {working: 0, idle: 1, away: 2}

function sortValue(row: RosterRow, key: SortKey): string | number | null {
  switch (key) {
    case 'student':
      return row.student.sortable_name.toLowerCase()
    case 'course':
      return row.course.name.toLowerCase()
    case 'status':
      return row.status ? STATUS_ORDER[row.status] : null
    case 'working_on':
      return row.current_item?.title.toLowerCase() ?? null
    case 'progress':
      return row.percent_complete
    case 'score':
      return row.score
    case 'last_active':
      return row.last_active_at ? new Date(row.last_active_at).getTime() : null
    case 'today':
      return row.seconds_today
    case 'week':
      return row.seconds_this_week
    case 'attempts':
      return row.attempts_on_current_item
  }
}

// Missing values (no grade, never active) sort last in either direction; ties
// fall back to the student's name.
export function sortRows(rows: RosterRow[], key: SortKey, direction: Direction): RosterRow[] {
  const sign = direction === 'ascending' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = sortValue(a, key)
    const y = sortValue(b, key)
    if (x !== y) {
      if (x === null) return 1
      if (y === null) return -1
      return (x < y ? -1 : 1) * sign
    }
    return a.student.sortable_name.localeCompare(b.student.sortable_name)
  })
}

type Props = {
  caption: string
  rows: RosterRow[]
  colors: Record<string, string>
  now: Date
  onOpenStudent: (key: RowKey) => void
  onTogglePin: (row: RosterRow) => void
}

export default function RosterTable({
  caption,
  rows,
  colors,
  now,
  onOpenStudent,
  onTogglePin,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [direction, setDirection] = useState<Direction>('ascending')

  const sorted = useMemo(() => sortRows(rows, sortKey, direction), [rows, sortKey, direction])

  const requestSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection(direction === 'ascending' ? 'descending' : 'ascending')
    } else {
      setSortKey(key)
      // numbers people scan for "who needs me" read best largest first
      setDirection(
        ['progress', 'score', 'last_active', 'today', 'week', 'attempts'].includes(key)
          ? 'descending'
          : 'ascending',
      )
    }
  }

  const header = (key: SortKey, label: string, width?: string) => (
    <Table.ColHeader
      id={key}
      width={width}
      onRequestSort={() => requestSort(key)}
      sortDirection={key === sortKey ? direction : 'none'}
    >
      {label}
    </Table.ColHeader>
  )

  return (
    <Table caption={caption} layout="auto" hover={true}>
      <Table.Head renderSortLabel={I18n.t('Sort by')}>
        <Table.Row>
          <Table.ColHeader id="pin" width="3rem">
            <ScreenReaderContent>{I18n.t('Caseload')}</ScreenReaderContent>
          </Table.ColHeader>
          {header('student', I18n.t('Student'))}
          {header('course', I18n.t('Course'))}
          {header('status', I18n.t('Now'))}
          {header('working_on', I18n.t('Working on'))}
          {header('progress', I18n.t('Progress'))}
          {header('score', I18n.t('Grade'))}
          {header('last_active', I18n.t('Last active'))}
          {header('today', I18n.t('Today'))}
          {header('week', I18n.t('This week'))}
          {header('attempts', I18n.t('Tries'))}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {sorted.map(row => {
          const color = colors[row.course.id]
          return (
            <Table.Row key={`${row.course.id}-${row.student.id}`}>
              <Table.Cell>
                <PinButton
                  pinned={row.pinned}
                  studentName={row.student.name}
                  onToggle={() => onTogglePin(row)}
                />
              </Table.Cell>
              <Table.RowHeader>
                <Link
                  isWithinText={false}
                  as="button"
                  onClick={() =>
                    onOpenStudent({courseId: row.course.id, studentId: row.student.id})
                  }
                >
                  {row.student.name}
                </Link>
              </Table.RowHeader>
              <Table.Cell>
                <CourseChip name={row.course.name} color={color} />
              </Table.Cell>
              <Table.Cell>
                <StatusBadge status={row.status} />
              </Table.Cell>
              <Table.Cell>
                {row.current_item ? (
                  <Text>{row.current_item.title}</Text>
                ) : (
                  <Text color="secondary">
                    {row.requirements_total > 0 &&
                    row.requirements_completed >= row.requirements_total
                      ? I18n.t('All done')
                      : I18n.t('Not started')}
                  </Text>
                )}
              </Table.Cell>
              <Table.Cell>
                <ProgressMeter
                  percent={row.percent_complete}
                  color={color}
                  label={I18n.t('%{name} progress in %{course}', {
                    name: row.student.name,
                    course: row.course.name,
                  })}
                />
              </Table.Cell>
              <Table.Cell>
                <span style={{fontVariantNumeric: 'tabular-nums'}}>{formatScore(row.score)}</span>
              </Table.Cell>
              <Table.Cell>
                <span style={{color: row.last_active_at ? INK.primary : INK.muted}}>
                  {formatLastActive(row.last_active_at, now)}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span style={{fontVariantNumeric: 'tabular-nums'}}>
                  {formatDuration(row.seconds_today)}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span style={{fontVariantNumeric: 'tabular-nums'}}>
                  {formatDuration(row.seconds_this_week)}
                </span>
              </Table.Cell>
              <Table.Cell>
                {isStuck(row) ? (
                  <StuckBadge attempts={row.attempts_on_current_item} />
                ) : (
                  <span style={{fontVariantNumeric: 'tabular-nums'}}>
                    {row.attempts_on_current_item}
                  </span>
                )}
              </Table.Cell>
            </Table.Row>
          )
        })}
      </Table.Body>
    </Table>
  )
}
