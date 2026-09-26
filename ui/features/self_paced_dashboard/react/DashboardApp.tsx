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

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {Button} from '@instructure/ui-buttons'
import {Spinner} from '@instructure/ui-spinner'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import BulkBar from './BulkBar'
import LiveBoard from './LiveBoard'
import RosterTable from './RosterTable'
import StudentTray from './StudentTray'
import Toolbar, {ALL_COURSES} from './Toolbar'
import {StatusShape} from './bits'
import {courseColors, INK} from './colors'
import {
  applyFilters,
  quickFilterCounts,
  quickFilterLabel,
  readViewState,
  writeViewState,
  type QuickFilter,
} from './filters'
import {fillTemplate, isStuck, STUCK_ATTEMPTS} from './format'
import {groupByStudent} from './grouping'
import {appBarBackground, Card, ELEVATION, MATERIAL_STYLES, Pill, ROBOTO, SLATE} from './material'
import type {DashboardConfig, Link, RosterRow, RowKey, StudentDetail} from './types'
import {useRoster} from './useRoster'

const I18n = createI18nScope('self_paced_dashboard')

type Tab = 'roster' | 'live'

export default function DashboardApp({config}: {config: DashboardConfig}) {
  const initial = useMemo(() => readViewState(window.location.search), [])
  const {rows, setRows, loadError, now, load, customColors} = useRoster(config)
  const [tab, setTab] = useState<Tab>(initial.tab ?? 'roster')
  const [courseFilter, setCourseFilter] = useState<string>(
    initial.course || config.course_id || ALL_COURSES,
  )
  const [caseloadOnly, setCaseloadOnly] = useState(false)
  const [search, setSearch] = useState(initial.search ?? '')
  const [quick, setQuick] = useState<QuickFilter>(initial.quick ?? 'all')
  const [selected, setSelected] = useState<RowKey | null>(null)
  const [expandAll, setExpandAll] = useState(false)
  const [stickyBottom, setStickyBottom] = useState(0)
  // students ticked for a bulk action (only when interventions are on)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const bulkUrl = config.bulk_interventions_url

  // ?student_id= (from a course page) opens that student's panel once the
  // roster is in
  const openStudent = useRef(new URLSearchParams(window.location.search).get('student_id'))
  useEffect(() => {
    const studentId = openStudent.current
    if (!rows || !studentId) return
    openStudent.current = null
    const row = groupByStudent(rows.filter(r => r.student.id === studentId))[0]?.primary
    if (row) setSelected({courseId: row.course.id, studentId})
  }, [rows])

  // Keep the view in the address bar so a reload or a shared link opens it.
  useEffect(() => {
    const query = writeViewState(window.location.search, {
      tab,
      search,
      quick,
      course: courseFilter === ALL_COURSES ? null : courseFilter,
    })
    if (query !== window.location.search) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query}`)
    }
  }, [tab, search, quick, courseFilter])

  // a new filter starts a new selection, so nothing hidden stays ticked
  useEffect(() => setSelection(new Set()), [courseFilter, caseloadOnly, search, quick])

  const select = useCallback((studentIds: string[], selected: boolean) => {
    setSelection(current => {
      const next = new Set(current)
      studentIds.forEach(id => (selected ? next.add(id) : next.delete(id)))
      return next
    })
  }, [])

  const courses = useMemo(() => {
    const byId = new Map<string, RosterRow['course']>()
    ;(rows ?? []).forEach(row => byId.set(row.course.id, row.course))
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const colors = useMemo(
    () => courseColors(config.course_ids ?? courses.map(c => c.id), customColors),
    [config.course_ids, courses, customColors],
  )

  // The course and caseload choices pick whose students these are...
  const scopedRows = useMemo(
    () =>
      (rows ?? []).filter(
        row =>
          (courseFilter === ALL_COURSES || row.course.id === courseFilter) &&
          (!caseloadOnly || row.pinned),
      ),
    [rows, courseFilter, caseloadOnly],
  )
  // ...and the search and quick filter narrow them down.
  const visibleRows = useMemo(
    () => applyFilters(scopedRows, {search, quick, now}),
    [scopedRows, search, quick, now],
  )
  const counts = useMemo(() => quickFilterCounts(scopedRows, now), [scopedRows, now])

  const togglePin = (row: RosterRow) => {
    const pinned = !row.pinned
    const update = (value: boolean) =>
      setRows(current =>
        (current ?? []).map(r => (r.student.id === row.student.id ? {...r, pinned: value} : r)),
      )
    update(pinned)
    doFetchApi({
      path: fillTemplate(config.caseload_url, {student_id: row.student.id}),
      method: pinned ? 'PUT' : 'DELETE',
    }).catch(() => update(!pinned))
  }

  const clearFilters = () => {
    setSearch('')
    setQuick('all')
  }

  if (loadError && rows === null) {
    return (
      <View as="div" padding="large 0">
        <Text color="danger">
          {I18n.t("The roster didn't load. Reload the page to try again.")}
        </Text>
      </View>
    )
  }

  if (rows === null) {
    return (
      <View as="div" textAlign="center" padding="xx-large">
        <Spinner renderTitle={I18n.t('Loading students')} />
      </View>
    )
  }

  // A card's student count, and the switch that opens every student's classes
  // when anyone in it takes more than one.
  const tableAside = (tableRows: RosterRow[]) => {
    const students = new Set(tableRows.map(row => row.student.id)).size
    return (
      <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
        {students < tableRows.length && (
          <Button
            size="small"
            color="primary"
            withBackground={false}
            aria-pressed={expandAll}
            onClick={() => setExpandAll(!expandAll)}
          >
            {expandAll ? I18n.t('Hide classes') : I18n.t('Show all classes')}
          </Button>
        )}
        <Pill>{I18n.t({one: '1 student', other: '%{count} students'}, {count: students})}</Pill>
      </span>
    )
  }

  const pinnedRows = visibleRows.filter(row => row.pinned)
  // the page for a class, where the course page is on
  const coursePageHref = (courseId: string) => coursePageUrl(config, courseId)
  const trayLinks = (detail: StudentDetail): Link[] => {
    const url = coursePageUrl(config, detail.course.id)
    return url ? [{label: I18n.t('Open %{course}', {course: detail.course.name}), url}] : []
  }
  const otherRows = visibleRows.filter(row => !row.pinned)
  const filteredCourse = courseFilter === ALL_COURSES ? null : courseFilter
  const barColor = filteredCourse ? colors[filteredCourse] || SLATE : SLATE
  const filtered = search.trim() !== '' || quick !== 'all'
  // pages of the roster start over when the filters change
  const filterKey = `${courseFilter}|${caseloadOnly}|${search}|${quick}`

  const empty =
    scopedRows.length === 0 ? (
      <EmptyState caseloadOnly={caseloadOnly} />
    ) : (
      <NoMatches search={search} quick={quick} onClear={clearFilters} />
    )

  return (
    <div
      className="self-paced-page"
      style={
        {
          padding: '0 0 48px',
          fontFamily: ROBOTO,
          '--sp-sticky-bottom': `${stickyBottom}px`,
        } as React.CSSProperties
      }
    >
      <style>{MATERIAL_STYLES}</style>

      {/* The title scrolls away; the toolbar under it stays pinned. */}
      <header
        style={{
          background: appBarBackground(barColor),
          color: '#fff',
          borderRadius: '2px 2px 0 0',
          boxShadow: ELEVATION[4],
        }}
      >
        <div style={{padding: '40px 32px 24px'}}>
          <h1
            style={{
              margin: '0 0 20px',
              fontFamily: ROBOTO,
              fontWeight: 300,
              fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.5px',
              color: '#fff',
            }}
          >
            {I18n.t('Your students')}
          </h1>
          <Summary rows={scopedRows} />
        </div>
      </header>

      <Toolbar
        color={barColor}
        stripe={filteredCourse ? [] : courses.map(course => colors[course.id])}
        tab={tab}
        onTab={setTab}
        search={search}
        onSearch={setSearch}
        courses={courses}
        course={courseFilter}
        onCourse={setCourseFilter}
        caseloadOnly={caseloadOnly}
        onCaseloadOnly={setCaseloadOnly}
        quick={quick}
        onQuick={setQuick}
        counts={counts}
        updatedAt={now}
        refreshFailed={loadError}
        onRefresh={load}
        onHeight={setStickyBottom}
      />

      {filtered && visibleRows.length > 0 && (
        <p aria-live="polite" style={{margin: '0 0 12px', color: INK.secondary}}>
          {I18n.t(
            {one: 'Showing 1 student.', other: 'Showing %{count} students.'},
            {count: new Set(visibleRows.map(row => row.student.id)).size},
          )}{' '}
          <Button size="small" withBackground={false} color="primary" onClick={clearFilters}>
            {I18n.t('Clear filters')}
          </Button>
        </p>
      )}

      <div role="tabpanel" id="roster-panel" aria-labelledby="roster-tab" hidden={tab !== 'roster'}>
        {visibleRows.length === 0 ? (
          empty
        ) : (
          <>
            {pinnedRows.length > 0 && (
              <Card
                title={I18n.t('My caseload')}
                labelledBy="self-paced-caseload-heading"
                aside={tableAside(pinnedRows)}
                padded={false}
                clip={false}
              >
                <RosterTable
                  caption={I18n.t('My caseload')}
                  rows={pinnedRows}
                  colors={colors}
                  now={now}
                  expandAll={expandAll}
                  pageKey={filterKey}
                  onOpenStudent={setSelected}
                  onTogglePin={togglePin}
                  selection={bulkUrl ? selection : undefined}
                  onSelect={bulkUrl ? select : undefined}
                  courseHref={coursePageHref}
                />
              </Card>
            )}
            {!caseloadOnly && otherRows.length > 0 && (
              <Card
                title={pinnedRows.length > 0 ? I18n.t('Everyone else') : I18n.t('Students')}
                labelledBy="self-paced-roster-heading"
                aside={tableAside(otherRows)}
                padded={false}
                clip={false}
              >
                <RosterTable
                  caption={pinnedRows.length > 0 ? I18n.t('Everyone else') : I18n.t('Students')}
                  rows={otherRows}
                  colors={colors}
                  now={now}
                  expandAll={expandAll}
                  pageKey={filterKey}
                  onOpenStudent={setSelected}
                  onTogglePin={togglePin}
                  selection={bulkUrl ? selection : undefined}
                  onSelect={bulkUrl ? select : undefined}
                  courseHref={coursePageHref}
                />
              </Card>
            )}
            {bulkUrl && selection.size > 0 && (
              <BulkBar
                url={bulkUrl}
                rows={visibleRows.filter(row => selection.has(row.student.id))}
                onClear={() => setSelection(new Set())}
                onDone={load}
              />
            )}
          </>
        )}
      </div>
      <div role="tabpanel" id="live-panel" aria-labelledby="live-tab" hidden={tab !== 'live'}>
        {tab === 'live' &&
          (visibleRows.length === 0 ? (
            empty
          ) : (
            <LiveBoard
              rows={visibleRows}
              colors={colors}
              now={now}
              idleMinutes={config.idle_minutes}
              onOpenStudent={setSelected}
            />
          ))}
      </div>

      <StudentTray
        selected={selected}
        studentUrl={config.student_url}
        pacingUrl={config.pacing_url}
        studentPacingUrl={config.student_pacing_url}
        interventionsUrl={config.interventions_url}
        links={trayLinks}
        colors={colors}
        classes={
          selected
            ? (rows ?? [])
                .filter(row => row.student.id === selected.studentId)
                .map(row => row.course)
                .sort((a, b) => a.name.localeCompare(b.name))
            : []
        }
        onSelectClass={courseId => selected && setSelected({...selected, courseId})}
        onClose={() => setSelected(null)}
        onPacingChanged={load}
      />
    </div>
  )
}

// The address of a course's own page, or null when it has none.
export function coursePageUrl(config: DashboardConfig, courseId: string): string | null {
  if (!config.course_page_url || !config.course_page_ids?.includes(courseId)) return null
  return fillTemplate(config.course_page_url, {course_id: courseId})
}

// White chips on the app bar: who's here, and who needs help. Counts students,
// not classes: someone working in one class counts as working.
export function Summary({rows}: {rows: RosterRow[]}) {
  const students = groupByStudent(rows).map(group => group.summary)
  const count = (status: string) => students.filter(row => row.status === status).length
  const stuck = students.filter(isStuck).length
  const live = students.some(row => row.status)
  const chip = (status: 'working' | 'idle' | 'away', text: string) => (
    <Pill background="#fff">
      <StatusShape status={status} size={11} />
      {text}
    </Pill>
  )
  return (
    <p style={{margin: 0, display: 'flex', flexWrap: 'wrap', gap: 8, lineHeight: 1.6}}>
      {live && (
        <>
          {chip('working', I18n.t('%{count} working now', {count: count('working')}))}
          {chip('idle', I18n.t('%{count} idle', {count: count('idle')}))}
          {chip('away', I18n.t('%{count} away', {count: count('away')}))}
        </>
      )}
      {stuck > 0 ? (
        <Pill background="#fff" color="#9e1f1f">
          <span aria-hidden="true" style={{fontWeight: 700}}>
            !
          </span>
          {I18n.t(
            {
              one: '1 student has tried the same item %{attempts} or more times.',
              other: '%{count} students have tried the same item %{attempts} or more times.',
            },
            {count: stuck, attempts: STUCK_ATTEMPTS},
          )}
        </Pill>
      ) : (
        <span style={{color: '#fff', opacity: 0.9, padding: '2px 4px'}}>
          {I18n.t('Nobody is stuck on an item.')}
        </span>
      )}
    </p>
  )
}

function EmptyState({caseloadOnly}: {caseloadOnly: boolean}) {
  return (
    <Card>
      <div style={{paddingTop: 16, color: INK.secondary}}>
        {caseloadOnly
          ? I18n.t('Your caseload is empty. Star students in the roster to add them.')
          : I18n.t('No students yet. Students show up here once they open a self-paced course.')}
      </div>
    </Card>
  )
}

function NoMatches({
  search,
  quick,
  onClear,
}: {
  search: string
  quick: QuickFilter
  onClear: () => void
}) {
  return (
    <Card>
      <div style={{paddingTop: 16, color: INK.secondary}}>
        {search.trim()
          ? I18n.t('No students match "%{search}".', {search: search.trim()})
          : I18n.t('No students are in "%{filter}" right now.', {
              filter: quickFilterLabel(quick),
            })}{' '}
        <Button size="small" withBackground={false} color="primary" onClick={onClear}>
          {I18n.t('Clear filters')}
        </Button>
      </div>
    </Card>
  )
}
