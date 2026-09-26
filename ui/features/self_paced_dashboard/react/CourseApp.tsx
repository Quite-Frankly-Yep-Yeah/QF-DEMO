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

import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {Button} from '@instructure/ui-buttons'
import {Menu} from '@instructure/ui-menu'
import {Spinner} from '@instructure/ui-spinner'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import PaceChart from '@canvas/self-paced/react/PaceChart'
import AlertsPanel from './AlertsPanel'
import BulkBar from './BulkBar'
import LiveBoard from './LiveBoard'
import RosterTable from './RosterTable'
import StudentTray from './StudentTray'
import Toolbar from './Toolbar'
import {courseColors, INK, STATUS_COLORS, tint} from './colors'
import {
  applyFilters,
  quickFilterCounts,
  readViewState,
  writeViewState,
  type QuickFilter,
} from './filters'
import {formatPercent} from './format'
import {appBarBackground, Card, ELEVATION, MATERIAL_STYLES, Pill, ROBOTO} from './material'
import type {CourseConfig, CourseSummary, DashboardConfig, Link, RowKey} from './types'
import {useRoster} from './useRoster'

const I18n = createI18nScope('self_paced_dashboard')

type Tab = 'roster' | 'live'
type Unit = CourseSummary['units'][number]

// The page for one course (Phase 5b): the class's students, where they are
// in the course, the items that take many tries and the class's pace. Built
// for a mentor working with one class; course editors also get links to
// change the course.
export default function CourseApp({
  config,
  course,
}: {
  config: DashboardConfig
  course: CourseConfig
}) {
  const initial = useMemo(() => readViewState(window.location.search), [])
  const {rows, setRows, loadError, now, load, customColors} = useRoster(config)
  const [summary, setSummary] = useState<CourseSummary | null>(null)
  const [tab, setTab] = useState<Tab>(initial.tab ?? 'roster')
  const [search, setSearch] = useState(initial.search ?? '')
  const [quick, setQuick] = useState<QuickFilter>(initial.quick ?? 'all')
  const [caseloadOnly, setCaseloadOnly] = useState(false)
  const [unit, setUnit] = useState<Unit | null>(null)
  const [selected, setSelected] = useState<RowKey | null>(null)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [stickyBottom, setStickyBottom] = useState(0)
  const bulkUrl = config.bulk_interventions_url
  const courseId = course.course.id

  const loadSummary = useCallback(() => {
    doFetchApi<CourseSummary>({path: course.summary_url})
      .then(({json}) => setSummary(json ?? null))
      .catch(() => {})
  }, [course.summary_url])
  useEffect(loadSummary, [loadSummary])

  const refresh = useCallback(() => {
    load()
    loadSummary()
  }, [load, loadSummary])

  useEffect(() => {
    const query = writeViewState(window.location.search, {tab, search, quick, course: null})
    if (query !== window.location.search) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query}`)
    }
  }, [tab, search, quick])

  useEffect(() => setSelection(new Set()), [search, quick, caseloadOnly, unit])

  const color = useMemo(
    () => courseColors(config.course_ids ?? [courseId], customColors)[courseId] ?? '#37474f',
    [config.course_ids, courseId, customColors],
  )
  const colors = useMemo(() => ({[courseId]: color}), [courseId, color])

  const classRows = useMemo(
    () => (rows ?? []).filter(row => row.course.id === courseId && (!caseloadOnly || row.pinned)),
    [rows, courseId, caseloadOnly],
  )
  const visibleRows = useMemo(() => {
    const filtered = applyFilters(classRows, {search, quick, now})
    if (!unit) return filtered
    const items = new Set(unit.item_ids)
    return filtered.filter(row => row.current_item && items.has(row.current_item.id))
  }, [classRows, search, quick, now, unit])
  const counts = useMemo(() => quickFilterCounts(classRows, now), [classRows, now])

  const select = useCallback((studentIds: string[], value: boolean) => {
    setSelection(current => {
      const next = new Set(current)
      studentIds.forEach(id => (value ? next.add(id) : next.delete(id)))
      return next
    })
  }, [])

  const togglePin = (row: (typeof classRows)[number]) => {
    const pinned = !row.pinned
    const update = (value: boolean) =>
      setRows(current =>
        (current ?? []).map(r => (r.student.id === row.student.id ? {...r, pinned: value} : r)),
      )
    update(pinned)
    doFetchApi({
      path: config.caseload_url.replace(':student_id', row.student.id),
      method: pinned ? 'PUT' : 'DELETE',
    }).catch(() => update(!pinned))
  }

  if (loadError && rows === null) {
    return (
      <View as="div" padding="large 0">
        <Text color="danger">{I18n.t("The class didn't load. Reload the page to try again.")}</Text>
      </View>
    )
  }
  if (rows === null) {
    return (
      <View as="div" textAlign="center" padding="xx-large">
        <Spinner renderTitle={I18n.t('Loading the class')} />
      </View>
    )
  }

  const trayLinks = (): Link[] =>
    config.dashboard_url && selected
      ? [
          {
            label: I18n.t('All their classes'),
            url: `${config.dashboard_url}?student_id=${encodeURIComponent(selected.studentId)}`,
          },
        ]
      : []

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
      <CourseHeader course={course} color={color} rows={classRows} counts={counts} />

      <Toolbar
        color={color}
        stripe={[]}
        tab={tab}
        onTab={setTab}
        search={search}
        onSearch={setSearch}
        courses={[course.course]}
        course={courseId}
        onCourse={() => {}}
        singleCourse={true}
        caseloadOnly={caseloadOnly}
        onCaseloadOnly={setCaseloadOnly}
        quick={quick}
        onQuick={setQuick}
        counts={counts}
        updatedAt={now}
        refreshFailed={loadError}
        onRefresh={refresh}
        onHeight={setStickyBottom}
      />

      {course.alerts_url && course.alert_rules_url && (
        <AlertsPanel
          courseId={courseId}
          alertsUrl={course.alerts_url}
          rulesUrl={course.alert_rules_url}
          canEditRules={!!course.can_edit_alert_rules}
          onOpenStudent={setSelected}
        />
      )}

      {summary && summary.units.length > 0 && (
        <UnitMap
          units={summary.units}
          students={classRows.length}
          color={color}
          chosen={unit}
          onChoose={setUnit}
        />
      )}

      <div role="tabpanel" id="roster-panel" aria-labelledby="roster-tab" hidden={tab !== 'roster'}>
        <Card
          title={
            unit
              ? I18n.t('Students on %{unit}', {unit: unit.name})
              : I18n.t('Students in this class')
          }
          labelledBy="self-paced-course-students"
          aside={
            <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
              {unit && (
                <Button
                  size="small"
                  withBackground={false}
                  color="primary"
                  onClick={() => setUnit(null)}
                >
                  {I18n.t('Show every unit')}
                </Button>
              )}
              <Pill>
                {I18n.t(
                  {one: '1 student', other: '%{count} students'},
                  {count: visibleRows.length},
                )}
              </Pill>
            </span>
          }
          padded={false}
          clip={false}
        >
          {visibleRows.length === 0 ? (
            <div style={{padding: 16, color: INK.secondary}}>
              {classRows.length === 0
                ? I18n.t('No students yet. Students show up here once they open the course.')
                : I18n.t('No students match these filters.')}
            </div>
          ) : (
            <RosterTable
              caption={I18n.t('Students in %{course}', {course: course.course.name})}
              rows={visibleRows}
              colors={colors}
              now={now}
              pageKey={`${search}|${quick}|${caseloadOnly}|${unit?.id}`}
              onOpenStudent={setSelected}
              onTogglePin={togglePin}
              selection={bulkUrl ? selection : undefined}
              onSelect={bulkUrl ? select : undefined}
            />
          )}
        </Card>
        {bulkUrl && selection.size > 0 && (
          <BulkBar
            url={bulkUrl}
            rows={visibleRows.filter(row => selection.has(row.student.id))}
            onClear={() => setSelection(new Set())}
            onDone={refresh}
            items={summary?.items}
            tools={summary?.tools}
          />
        )}
      </div>
      <div role="tabpanel" id="live-panel" aria-labelledby="live-tab" hidden={tab !== 'live'}>
        {tab === 'live' && (
          <LiveBoard
            rows={visibleRows}
            colors={colors}
            now={now}
            idleMinutes={config.idle_minutes}
            onOpenStudent={setSelected}
          />
        )}
      </div>

      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26rem), 1fr))',
            gap: 16,
            marginTop: 8,
          }}
        >
          <HardItems items={summary.hard_items} color={color} />
          <Card title={I18n.t('Class pace')} labelledBy="self-paced-course-pace">
            {summary.chart ? (
              <PaceChart
                chart={summary.chart}
                color={color}
                height={200}
                title={I18n.t('Average progress against the average plan')}
              />
            ) : (
              <span style={{color: INK.secondary}}>{I18n.t("This course isn't paced.")}</span>
            )}
          </Card>
        </div>
      )}

      <StudentTray
        selected={selected}
        studentUrl={config.student_url}
        pacingUrl={config.pacing_url}
        studentPacingUrl={config.student_pacing_url}
        interventionsUrl={config.interventions_url}
        links={trayLinks}
        colors={colors}
        classes={[course.course]}
        onSelectClass={() => {}}
        onClose={() => setSelected(null)}
        onPacingChanged={refresh}
      />
    </div>
  )
}

// The course's app bar: its name, how the class is doing, and the way to the
// Students page and to editing the course.
function CourseHeader({
  course,
  color,
  rows,
  counts,
}: {
  course: CourseConfig
  color: string
  rows: {percent_complete: number}[]
  counts: Record<QuickFilter, number>
}) {
  const average = rows.length
    ? rows.reduce((sum, row) => sum + row.percent_complete, 0) / rows.length
    : 0
  const chip = (text: string, alert = false) => (
    <Pill background="#fff" color={alert ? '#9e1f1f' : INK.primary}>
      {text}
    </Pill>
  )
  return (
    <header
      style={{
        background: appBarBackground(color),
        color: '#fff',
        borderRadius: '2px 2px 0 0',
        boxShadow: ELEVATION[4],
        padding: '24px 32px',
      }}
    >
      <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12}}>
        <a href={course.dashboard_url} style={{color: '#fff', fontWeight: 500}}>
          {I18n.t('All students')}
        </a>
        <span style={{flex: 1}} />
        {course.report_links && course.report_links.length > 0 && (
          <Menu
            placement="bottom end"
            trigger={
              <button type="button" style={RAISED}>
                {I18n.t('Download report')}
              </button>
            }
          >
            {course.report_links.map(link => (
              <Menu.Item key={link.url} href={link.url}>
                {link.label}
              </Menu.Item>
            ))}
          </Menu>
        )}
        {course.edit_links && course.edit_links.length > 0 && (
          <Menu
            placement="bottom end"
            trigger={
              <button type="button" style={RAISED}>
                {I18n.t('Edit course')}
              </button>
            }
          >
            {course.edit_links.map(link => (
              <Menu.Item key={link.url} href={link.url}>
                {link.label}
              </Menu.Item>
            ))}
          </Menu>
        )}
      </div>
      <h1
        style={{
          margin: '16px 0 4px',
          fontFamily: ROBOTO,
          fontWeight: 300,
          fontSize: 'clamp(2rem, 4.5vw, 3rem)',
          lineHeight: 1.1,
          color: '#fff',
        }}
      >
        {course.course.name}
      </h1>
      <div style={{opacity: 0.9, marginBottom: 16}}>{course.course.course_code}</div>
      <p style={{margin: 0, display: 'flex', flexWrap: 'wrap', gap: 8}}>
        {chip(I18n.t({one: '1 student', other: '%{count} students'}, {count: rows.length}))}
        {chip(I18n.t('%{percent} done on average', {percent: formatPercent(average)}))}
        {chip(I18n.t('%{count} behind pace', {count: counts.behind}), counts.behind > 0)}
        {chip(I18n.t('%{count} stuck', {count: counts.stuck}), counts.stuck > 0)}
        {chip(I18n.t('%{count} inactive', {count: counts.inactive}), counts.inactive > 0)}
      </p>
    </header>
  )
}

const RAISED: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 2,
  border: 'none',
  background: '#fff',
  color: INK.primary,
  fontFamily: ROBOTO,
  fontSize: '0.875rem',
  fontWeight: 500,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  boxShadow: ELEVATION[2],
  cursor: 'pointer',
}

// One tile per unit, shaded by how many students are on it. Choosing a tile
// shows only the students on that unit.
function UnitMap({
  units,
  students,
  color,
  chosen,
  onChoose,
}: {
  units: Unit[]
  students: number
  color: string
  chosen: Unit | null
  onChoose: (unit: Unit | null) => void
}) {
  const most = Math.max(1, ...units.map(u => u.students_here))
  return (
    <Card title={I18n.t('Where the class is')} labelledBy="self-paced-course-units">
      <p style={{margin: '0 0 12px', color: INK.secondary}}>
        {I18n.t('Darker units have more students on them. Choose one to see who.')}
      </p>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: '0 0 8px',
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: 'minmax(9.5rem, 1fr)',
          gap: 8,
          overflowX: 'auto',
        }}
      >
        {units.map(unit => {
          const isChosen = chosen?.id === unit.id
          const share = unit.students_here / most
          return (
            <li key={unit.id}>
              <button
                type="button"
                aria-pressed={isChosen}
                onClick={() => onChoose(isChosen ? null : unit)}
                style={{
                  width: '100%',
                  height: '100%',
                  textAlign: 'left',
                  padding: 12,
                  border: 'none',
                  borderRadius: 2,
                  borderTop: `4px solid ${unit.students_here ? color : tint(color, 0.3)}`,
                  background: unit.students_here ? tint(color, 0.06 + 0.3 * share) : '#fafafa',
                  boxShadow: isChosen ? `inset 0 0 0 2px ${color}, ${ELEVATION[2]}` : 'none',
                  fontFamily: ROBOTO,
                  color: INK.primary,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontWeight: 500,
                    minHeight: '2.6em',
                  }}
                >
                  {unit.name}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '2rem',
                    fontWeight: 300,
                    lineHeight: 1.2,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {unit.students_here}
                </span>
                <span style={{display: 'block', fontSize: '0.8125rem', color: INK.secondary}}>
                  {I18n.t(
                    {one: 'student here', other: 'students here'},
                    {count: unit.students_here},
                  )}
                </span>
                {unit.stuck_here > 0 && (
                  <span style={{display: 'inline-block', marginTop: 6}}>
                    <Pill background={tint(STATUS_COLORS.stuck, 0.14)} color="#9e1f1f">
                      {I18n.t('%{count} stuck', {count: unit.stuck_here})}
                    </Pill>
                  </span>
                )}
                <span
                  style={{
                    display: 'block',
                    marginTop: 8,
                    fontSize: '0.8125rem',
                    color: INK.secondary,
                  }}
                >
                  {I18n.t('%{done} of %{total} finished', {done: unit.completed, total: students})}
                </span>
                <span
                  aria-hidden="true"
                  style={{display: 'block', height: 4, marginTop: 4, background: tint(color, 0.2)}}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${students ? (unit.completed / students) * 100 : 0}%`,
                      background: color,
                    }}
                  />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

// The graded items where students needed the most tries.
function HardItems({items, color}: {items: CourseSummary['hard_items']; color: string}) {
  return (
    <Card title={I18n.t('Items that take many tries')} labelledBy="self-paced-course-hard">
      {items.length === 0 ? (
        <span style={{color: INK.secondary}}>
          {I18n.t('Nothing yet. Items show up here when students need more than one try.')}
        </span>
      ) : (
        <ol style={{listStyle: 'none', margin: 0, padding: 0}}>
          {items.map(item => (
            <li
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '2px 12px',
                padding: '10px 0',
                borderTop: '1px solid rgba(0,0,0,0.12)',
              }}
            >
              <span style={{fontWeight: 500, overflowWrap: 'anywhere'}}>{item.title}</span>
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 500,
                  color: INK.primary,
                  background: tint(color, 0.14),
                  padding: '0 8px',
                  borderRadius: 12,
                  alignSelf: 'start',
                }}
              >
                {I18n.t('%{tries} tries on average', {tries: item.average_tries})}
              </span>
              <span style={{gridColumn: '1 / -1', color: INK.secondary, fontSize: '0.875rem'}}>
                {I18n.t(
                  '%{module}: %{many} of %{tried} needed 3 or more tries; %{here} on it now',
                  {
                    module: item.module,
                    many: item.needed_many_tries,
                    tried: item.students_tried,
                    here: item.students_on_it,
                  },
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
