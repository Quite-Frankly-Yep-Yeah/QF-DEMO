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

import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {Checkbox} from '@instructure/ui-checkbox'
import {Heading} from '@instructure/ui-heading'
import {SimpleSelect} from '@instructure/ui-simple-select'
import {Spinner} from '@instructure/ui-spinner'
import {Tabs} from '@instructure/ui-tabs'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import LiveBoard from './LiveBoard'
import RosterTable from './RosterTable'
import StudentTray from './StudentTray'
import {StatusShape} from './bits'
import {courseColors, INK} from './colors'
import {fillTemplate, isStuck, STUCK_ATTEMPTS} from './format'
import type {DashboardConfig, RosterRow, RowKey} from './types'

const I18n = createI18nScope('self_paced_dashboard')

const ALL_COURSES = 'all'

// hover and keyboard focus for the live board's seats
const STYLES = `
  .self-paced-seat:hover { background: rgba(11, 11, 11, 0.04) !important; }
  .self-paced-seat:focus-visible { outline: 2px solid #2a78d6; outline-offset: 2px; }
`

export default function DashboardApp({config}: {config: DashboardConfig}) {
  const [rows, setRows] = useState<RosterRow[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [customColors, setCustomColors] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'roster' | 'live'>('roster')
  const [courseFilter, setCourseFilter] = useState<string>(config.course_id || ALL_COURSES)
  const [caseloadOnly, setCaseloadOnly] = useState(false)
  const [selected, setSelected] = useState<RowKey | null>(null)

  const load = useCallback(() => {
    doFetchApi<{rows: RosterRow[]}>({
      path: config.roster_url,
      params: {idle_minutes: config.idle_minutes},
    })
      .then(({json}) => {
        setRows(json?.rows ?? [])
        setNow(new Date())
        setLoadError(false)
      })
      .catch(() => setLoadError(true))
  }, [config.roster_url, config.idle_minutes])

  // Poll while the page is visible; catch up straight away when it comes back.
  useEffect(() => {
    load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, config.poll_seconds * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, config.poll_seconds])

  // the viewer's own Canvas course colors, if they've picked any
  useEffect(() => {
    doFetchApi<{custom_colors: Record<string, string>}>({path: '/api/v1/users/self/colors'})
      .then(({json}) => setCustomColors(json?.custom_colors ?? {}))
      .catch(() => {})
  }, [])

  const courses = useMemo(() => {
    const byId = new Map<string, RosterRow['course']>()
    ;(rows ?? []).forEach(row => byId.set(row.course.id, row.course))
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const colors = useMemo(
    () =>
      courseColors(
        courses.map(c => c.id),
        customColors,
      ),
    [courses, customColors],
  )

  const visibleRows = useMemo(
    () =>
      (rows ?? []).filter(
        row =>
          (courseFilter === ALL_COURSES || row.course.id === courseFilter) &&
          (!caseloadOnly || row.pinned),
      ),
    [rows, courseFilter, caseloadOnly],
  )

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

  const pinnedRows = visibleRows.filter(row => row.pinned)
  const otherRows = visibleRows.filter(row => !row.pinned)

  return (
    <View as="div" padding="small 0 large">
      <style>{STYLES}</style>
      <Heading level="h1" margin="0 0 x-small">
        {I18n.t('Your students')}
      </Heading>
      <Summary rows={visibleRows} />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: 24,
          margin: '20px 0 8px',
        }}
      >
        <div style={{minWidth: '16rem'}}>
          <SimpleSelect
            renderLabel={I18n.t('Course')}
            value={courseFilter}
            onChange={(_event, {value}) => setCourseFilter(String(value))}
          >
            <SimpleSelect.Option id="course-all" value={ALL_COURSES}>
              {I18n.t('All my courses')}
            </SimpleSelect.Option>
            {courses.map(course => (
              <SimpleSelect.Option key={course.id} id={`course-${course.id}`} value={course.id}>
                {course.name}
              </SimpleSelect.Option>
            ))}
          </SimpleSelect>
        </div>
        <div style={{paddingBottom: 8}}>
          <Checkbox
            variant="toggle"
            label={I18n.t('Only my caseload')}
            checked={caseloadOnly}
            onChange={() => setCaseloadOnly(!caseloadOnly)}
          />
        </div>
        {loadError && (
          <Text color="secondary" size="small">
            {I18n.t("Couldn't refresh just now. Showing the last update.")}
          </Text>
        )}
      </div>

      <Tabs onRequestTabChange={(_event, {index}) => setTab(index === 0 ? 'roster' : 'live')}>
        <Tabs.Panel
          id="self-paced-roster"
          renderTitle={I18n.t('Roster')}
          isSelected={tab === 'roster'}
        >
          {visibleRows.length === 0 ? (
            <EmptyState caseloadOnly={caseloadOnly} />
          ) : (
            <>
              {pinnedRows.length > 0 && (
                <View as="section" margin="0 0 large">
                  <Heading level="h2" margin="small 0">
                    {I18n.t('My caseload')}
                  </Heading>
                  <RosterTable
                    caption={I18n.t('My caseload')}
                    rows={pinnedRows}
                    colors={colors}
                    now={now}
                    onOpenStudent={setSelected}
                    onTogglePin={togglePin}
                  />
                </View>
              )}
              {!caseloadOnly && otherRows.length > 0 && (
                <View as="section">
                  {pinnedRows.length > 0 && (
                    <Heading level="h2" margin="small 0">
                      {I18n.t('Everyone else')}
                    </Heading>
                  )}
                  <RosterTable
                    caption={pinnedRows.length > 0 ? I18n.t('Everyone else') : I18n.t('Students')}
                    rows={otherRows}
                    colors={colors}
                    now={now}
                    onOpenStudent={setSelected}
                    onTogglePin={togglePin}
                  />
                </View>
              )}
            </>
          )}
        </Tabs.Panel>
        <Tabs.Panel id="self-paced-live" renderTitle={I18n.t('Live')} isSelected={tab === 'live'}>
          {visibleRows.length === 0 ? (
            <EmptyState caseloadOnly={caseloadOnly} />
          ) : (
            <LiveBoard
              rows={visibleRows}
              colors={colors}
              now={now}
              idleMinutes={config.idle_minutes}
              onOpenStudent={setSelected}
            />
          )}
        </Tabs.Panel>
      </Tabs>

      <StudentTray
        selected={selected}
        studentUrl={config.student_url}
        colors={colors}
        onClose={() => setSelected(null)}
      />
    </View>
  )
}

// One sentence instead of a row of number tiles: who's here, and who needs help.
export function Summary({rows}: {rows: RosterRow[]}) {
  const count = (status: string) => rows.filter(row => row.status === status).length
  const stuck = rows.filter(isStuck).length
  const live = rows.some(row => row.status)
  const part = (status: 'working' | 'idle' | 'away', text: string) => (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 16}}>
      <StatusShape status={status} size={11} />
      {text}
    </span>
  )
  return (
    <p style={{margin: 0, color: INK.secondary, fontSize: '1rem', lineHeight: 1.6}}>
      {live && (
        <>
          {part('working', I18n.t('%{count} working now', {count: count('working')}))}
          {part('idle', I18n.t('%{count} idle', {count: count('idle')}))}
          {part('away', I18n.t('%{count} away', {count: count('away')}))}
        </>
      )}
      {stuck > 0 ? (
        <span style={{color: '#9e1f1f', fontWeight: 500}}>
          {I18n.t(
            {
              one: '1 student has tried the same item %{attempts} or more times.',
              other: '%{count} students have tried the same item %{attempts} or more times.',
            },
            {count: stuck, attempts: STUCK_ATTEMPTS},
          )}
        </span>
      ) : (
        <span>{I18n.t('Nobody is stuck on an item.')}</span>
      )}
    </p>
  )
}

function EmptyState({caseloadOnly}: {caseloadOnly: boolean}) {
  return (
    <View as="div" padding="large 0">
      <Text color="secondary">
        {caseloadOnly
          ? I18n.t('Your caseload is empty. Star students in the roster to add them.')
          : I18n.t('No students yet. Students show up here once they open a self-paced course.')}
      </Text>
    </View>
  )
}
