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

import React, {useEffect, useMemo, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Table} from '@instructure/ui-table'
import {Button, IconButton} from '@instructure/ui-buttons'
import {IconArrowOpenDownLine, IconArrowOpenEndLine} from '@instructure/ui-icons'
import {Link} from '@instructure/ui-link'
import {Text} from '@instructure/ui-text'
import PaceBadge from '@canvas/self-paced/react/PaceBadge'
import ParentInviteMenu from '@canvas/self-paced/react/ParentInviteMenu'
import {
  CourseChip,
  PinButton,
  ProgressMeter,
  ScreenReaderContent,
  StatusBadge,
  StuckBadge,
  StudentAvatar,
} from './bits'
import {INK} from './colors'
import {formatDuration, formatLastActive, formatScore, isStuck} from './format'
import {groupByStudent, type StudentGroup} from './grouping'
import {DIVIDER, Pill} from './material'
import type {RosterRow, RowKey, Status} from './types'
import {ACCENT_TEXT} from '@canvas/material'

const I18n = createI18nScope('self_paced_dashboard')

// The Students page shows the parent sign-up menu when the school has the
// observer view on (ENV.SELF_PACED_DASHBOARD.parent_invites).
const canInviteParents = () =>
  Boolean(
    (window.ENV as {SELF_PACED_DASHBOARD?: {parent_invites?: boolean}}).SELF_PACED_DASHBOARD
      ?.parent_invites,
  )

export type SortKey =
  | 'student'
  | 'course'
  | 'status'
  | 'working_on'
  | 'progress'
  | 'pace'
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
    case 'pace':
      return row.days_behind
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
  expandAll?: boolean // show every student's classes
  pageKey?: string // when it changes (new filters), go back to the first page
  onOpenStudent: (key: RowKey) => void
  onTogglePin: (row: RosterRow) => void
  // students ticked for a bulk action; no checkboxes without it
  selection?: Set<string>
  onSelect?: (studentIds: string[], selected: boolean) => void
  // a course's own page, for the course chips
  courseHref?: (courseId: string) => string | null
}

// Students drawn at a time, so a big roster stays quick to render and scroll.
export const PAGE_SIZE = 50

// Narrow screens get InstUI's stacked table: one card-like block per row.
function useNarrow(): boolean {
  const query = '(max-width: 48rem)'
  const [narrow, setNarrow] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(query)
    const onChange = () => setNarrow(list.matches)
    list.addEventListener?.('change', onChange)
    return () => list.removeEventListener?.('change', onChange)
  }, [])
  return narrow
}

// One row per student. A student in more than one class gets a button that
// shows a row for each class underneath.
// A student with accommodations the viewer may see: a small dot, never the
// word "IEP" or "504" (docs/teacher-workflow-plan.md §2.3). Open the student to
// read them.
function SupportsDot({name}: {name: string}) {
  const label = I18n.t('%{name} has accommodations', {name})
  return (
    <span
      role="img"
      aria-label={label}
      title={I18n.t('Has accommodations')}
      data-testid="supports-dot"
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: '#6A1B9A',
        flex: '0 0 auto',
      }}
    />
  )
}

export default function RosterTable({
  caption,
  rows,
  colors,
  now,
  expandAll = false,
  pageKey,
  onOpenStudent,
  onTogglePin,
  selection,
  onSelect,
  courseHref,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [direction, setDirection] = useState<Direction>('ascending')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [shown, setShown] = useState(PAGE_SIZE)
  const narrow = useNarrow()

  useEffect(() => setShown(PAGE_SIZE), [pageKey])

  const groups = useMemo(() => groupByStudent(rows), [rows])
  const sorted = useMemo(() => {
    const byId = new Map(groups.map(group => [group.student.id, group]))
    return sortRows(
      groups.map(group => group.summary),
      sortKey,
      direction,
    ).map(summary => byId.get(summary.student.id) as StudentGroup)
  }, [groups, sortKey, direction])

  // "Show all classes" opens or closes every student at once.
  useEffect(() => {
    setExpanded(expandAll ? new Set(groups.map(group => group.student.id)) : new Set())
    // only when the switch changes, not on every poll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandAll])

  // The pace column only appears when at least one course is paced.
  const paced = rows.some(row => row.days_behind !== null)

  const requestSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection(direction === 'ascending' ? 'descending' : 'ascending')
    } else {
      setSortKey(key)
      // numbers people scan for "who needs me" read best largest first
      setDirection(
        ['progress', 'pace', 'score', 'last_active', 'today', 'week', 'attempts'].includes(key)
          ? 'descending'
          : 'ascending',
      )
    }
  }

  const selectable = !!(selection && onSelect)
  const allIds = sorted.map(group => group.student.id)
  const selectedHere = selection ? allIds.filter(id => selection.has(id)).length : 0

  const toggle = (id: string) =>
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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

  // The cells from "Now" onwards, for one class.
  const classCells = (row: RosterRow, color: string) => [
    <Table.Cell key="status">
      <StatusBadge status={row.status} />
    </Table.Cell>,
    <Table.Cell key="working_on">
      <WorkingOn row={row} />
    </Table.Cell>,
    <Table.Cell key="progress">
      <ProgressMeter
        percent={row.percent_complete}
        color={color}
        label={I18n.t('%{name} progress in %{course}', {
          name: row.student.name,
          course: row.course.name,
        })}
      />
    </Table.Cell>,
    ...(paced
      ? [
          <Table.Cell key="pace">
            <PaceBadge daysAhead={row.days_behind === null ? null : -row.days_behind} />
          </Table.Cell>,
        ]
      : []),
    <Table.Cell key="score">
      <span style={{fontVariantNumeric: 'tabular-nums'}}>{formatScore(row.score)}</span>
    </Table.Cell>,
    ...timeCells(row),
  ]

  const timeCells = (row: RosterRow) => [
    <Table.Cell key="last_active">
      <span style={{color: row.last_active_at ? INK.primary : INK.muted}}>
        {formatLastActive(row.last_active_at, now)}
      </span>
    </Table.Cell>,
    <Table.Cell key="today">
      <span style={{fontVariantNumeric: 'tabular-nums'}}>{formatDuration(row.seconds_today)}</span>
    </Table.Cell>,
    <Table.Cell key="week">
      <span style={{fontVariantNumeric: 'tabular-nums'}}>
        {formatDuration(row.seconds_this_week)}
      </span>
    </Table.Cell>,
    <Table.Cell key="attempts">
      {isStuck(row) ? (
        <StuckBadge attempts={row.attempts_on_current_item} />
      ) : (
        <span style={{fontVariantNumeric: 'tabular-nums'}}>{row.attempts_on_current_item}</span>
      )}
    </Table.Cell>,
  ]

  // InstUI's Table.Row types its children one by one, so pass the cells as
  // separate arguments rather than as an array.
  const tableRow = (key: string, cells: React.ReactElement[]) =>
    React.createElement(Table.Row, {key}, ...cells)

  const studentRow = (group: StudentGroup) => {
    const {student, primary, summary} = group
    const multiple = group.rows.length > 1
    const isOpen = multiple && expanded.has(student.id)
    const color = colors[primary.course.id]
    return tableRow(student.id, [
      ...(selectable
        ? [
            <Table.Cell key="select">
              <Checkbox
                label={I18n.t('Select %{name}', {name: student.name})}
                checked={selection?.has(student.id) ?? false}
                onChange={checked => onSelect?.([student.id], checked)}
              />
            </Table.Cell>,
          ]
        : []),
      <Table.Cell key="expand">
        {multiple && (
          <IconButton
            size="small"
            withBackground={false}
            withBorder={false}
            renderIcon={isOpen ? <IconArrowOpenDownLine /> : <IconArrowOpenEndLine />}
            screenReaderLabel={
              isOpen
                ? I18n.t("Hide %{name}'s classes", {name: student.name})
                : I18n.t("Show %{name}'s classes", {name: student.name})
            }
            aria-expanded={isOpen}
            onClick={() => toggle(student.id)}
          />
        )}
      </Table.Cell>,
      <Table.Cell key="pin">
        <PinButton
          pinned={summary.pinned}
          studentName={student.name}
          onToggle={() => onTogglePin(primary)}
        />
      </Table.Cell>,
      <Table.RowHeader key="name">
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 12}}>
          <StudentAvatar name={student.name} color={color} size={32} />
          <Link
            isWithinText={false}
            as="button"
            onClick={() => onOpenStudent({courseId: primary.course.id, studentId: student.id})}
          >
            {student.name}
          </Link>
          {group.rows.some(row => row.supports) && <SupportsDot name={student.name} />}
          {canInviteParents() && (
            <ParentInviteMenu studentId={student.id} studentName={student.name} />
          )}
        </span>
      </Table.RowHeader>,
      <Table.Cell key="course">
        {multiple ? (
          <ClassesSummary group={group} colors={colors} />
        ) : (
          <CourseChip
            name={primary.course.name}
            color={color}
            href={courseHref?.(primary.course.id)}
          />
        )}
      </Table.Cell>,
      ...(multiple
        ? [
            <Table.Cell key="status">
              <StatusBadge status={summary.status} />
            </Table.Cell>,
            // What they're on, progress, pace, grade and tries belong to a
            // class, so the collapsed row leaves them to the class rows.
            <Table.Cell key="working_on">{null}</Table.Cell>,
            <Table.Cell key="progress">{null}</Table.Cell>,
            ...(paced ? [<Table.Cell key="pace">{null}</Table.Cell>] : []),
            <Table.Cell key="score">{null}</Table.Cell>,
            // last active, today and this week are the student's, across classes
            ...timeCells(summary).slice(0, 3),
            <Table.Cell key="attempts">{null}</Table.Cell>,
          ]
        : classCells(primary, color)),
    ])
  }

  // A row per class under an opened student.
  const classRow = (row: RosterRow) => {
    const color = colors[row.course.id]
    return tableRow(`${row.student.id}-${row.course.id}`, [
      ...(selectable ? [<Table.Cell key="select">{null}</Table.Cell>] : []),
      <Table.Cell key="expand">{null}</Table.Cell>,
      <Table.Cell key="pin">{null}</Table.Cell>,
      <Table.RowHeader key="name">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 20,
            borderLeft: `2px solid ${color}`,
          }}
        >
          <Link
            isWithinText={false}
            as="button"
            onClick={() => onOpenStudent({courseId: row.course.id, studentId: row.student.id})}
          >
            <ScreenReaderContent>{`${row.student.name}, `}</ScreenReaderContent>
            {row.course.name}
          </Link>
        </span>
      </Table.RowHeader>,
      <Table.Cell key="course">
        <CourseChip name={row.course.name} color={color} href={courseHref?.(row.course.id)} />
      </Table.Cell>,
      ...classCells(row, color),
    ])
  }

  return (
    <div className="self-paced-roster">
      <Table caption={caption} layout={narrow ? 'stacked' : 'auto'} hover={true}>
        <Table.Head renderSortLabel={I18n.t('Sort by')}>
          <Table.Row>
            {selectable && (
              <Table.ColHeader id="select" width="3rem">
                <Checkbox
                  label={I18n.t('Select all %{count} students in %{table}', {
                    count: allIds.length,
                    table: caption,
                  })}
                  checked={allIds.length > 0 && selectedHere === allIds.length}
                  indeterminate={selectedHere > 0 && selectedHere < allIds.length}
                  onChange={checked => onSelect?.(allIds, checked)}
                />
              </Table.ColHeader>
            )}
            <Table.ColHeader id="expand" width="3rem">
              <ScreenReaderContent>{I18n.t('Classes')}</ScreenReaderContent>
            </Table.ColHeader>
            <Table.ColHeader id="pin" width="3rem">
              <ScreenReaderContent>{I18n.t('Caseload')}</ScreenReaderContent>
            </Table.ColHeader>
            {header('student', I18n.t('Student'))}
            {header('course', I18n.t('Course'))}
            {header('status', I18n.t('Now'))}
            {header('working_on', I18n.t('Working on'))}
            {header('progress', I18n.t('Progress'))}
            {paced && header('pace', I18n.t('Pace'))}
            {header('score', I18n.t('Grade'))}
            {header('last_active', I18n.t('Last active'))}
            {header('today', I18n.t('Today'))}
            {header('week', I18n.t('This week'))}
            {header('attempts', I18n.t('Tries'))}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted
            .slice(0, shown)
            .flatMap(group => [
              studentRow(group),
              ...(group.rows.length > 1 && expanded.has(group.student.id)
                ? group.rows.map(classRow)
                : []),
            ])}
        </Table.Body>
      </Table>
      {sorted.length > shown && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '12px 16px',
            borderTop: `1px solid ${DIVIDER}`,
            color: INK.secondary,
          }}
        >
          {I18n.t('Showing %{shown} of %{total} students', {shown, total: sorted.length})}
          <Button
            size="small"
            color="primary"
            withBackground={false}
            themeOverride={{primaryGhostColor: ACCENT_TEXT, primaryGhostBorderColor: ACCENT_TEXT}}
            onClick={() => setShown(shown + PAGE_SIZE)}
          >
            {I18n.t('Show %{count} more', {count: Math.min(PAGE_SIZE, sorted.length - shown)})}
          </Button>
        </div>
      )}
    </div>
  )
}

function WorkingOn({row}: {row: RosterRow}) {
  if (!row.current_item) {
    return (
      <Text color="secondary">
        {row.requirements_total > 0 && row.requirements_completed >= row.requirements_total
          ? I18n.t('All done')
          : I18n.t('Not started')}
      </Text>
    )
  }
  return <Text>{row.current_item.title}</Text>
}

// A collapsed student's classes: a dot in each class's color and a count.
function ClassesSummary({group, colors}: {group: StudentGroup; colors: Record<string, string>}) {
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
      <span aria-hidden="true" style={{display: 'inline-flex', gap: 3}}>
        {group.rows.map(row => (
          <span
            key={row.course.id}
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: colors[row.course.id],
            }}
          />
        ))}
      </span>
      <Pill>{I18n.t({one: '1 class', other: '%{count} classes'}, {count: group.rows.length})}</Pill>
      <ScreenReaderContent>{group.rows.map(row => row.course.name).join(', ')}</ScreenReaderContent>
    </span>
  )
}

// A plain checkbox whose label is only for screen readers, so a column of
// them stays narrow.
function Checkbox({
  label,
  checked,
  indeterminate = false,
  onChange,
}: {
  label: string
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={input => {
        if (input) input.indeterminate = indeterminate
      }}
      onChange={event => onChange(event.target.checked)}
      style={{width: 18, height: 18, margin: 0, accentColor: '#37474f', cursor: 'pointer'}}
    />
  )
}
