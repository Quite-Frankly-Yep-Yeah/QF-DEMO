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
import doFetchApi from '@canvas/do-fetch-api-effect'
import {greeting} from '../../self_paced_home/react/HomeApp'
import {Progress} from '../../self_paced_home/react/CourseCard'
import {
  APP_BAR,
  classColors,
  ELEVATION,
  INK,
  ink,
  PALETTE,
  ROBOTO,
  SURFACE,
  tint,
} from '../../self_paced_home/react/material'
import FindStudent from './FindStudent'
import type {
  CourseProgress,
  Grade,
  LinkRequest,
  ObservedStudent,
  ObserverConfig,
  ObserverData,
} from './types'
import {PAPER, SUCCESS} from '@canvas/material'
import {useMaterialPage} from '@canvas/material/useMaterialPage'

const I18n = createI18nScope('self_paced_observer')

// "3 days ago", "today", from the days between two dates.
export function agoText(iso: string | null, now: Date): string {
  if (!iso) return I18n.t('Not started yet')
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return I18n.t('Active today')
  return I18n.t(
    {one: 'Last active 1 day ago', other: 'Last active %{count} days ago'},
    {count: days},
  )
}

export function paceText(pace: CourseProgress['pace']): {label: string; color: string} | null {
  if (!pace) return null
  const days = pace.days_behind
  const behind = I18n.t({one: '1 day behind', other: '%{count} days behind'}, {count: days})
  if (days >= 3) return {label: behind, color: '#C62828'}
  if (days > 0) return {label: behind, color: '#EF6C00'}
  if (days < 0) {
    return {
      label: I18n.t({one: '1 day ahead', other: '%{count} days ahead'}, {count: -days}),
      color: SUCCESS,
    }
  }
  return {label: I18n.t('On track'), color: '#2E7D32'}
}

function Panel({
  id,
  title,
  children,
  accent,
}: {
  id: string
  title: string
  children: React.ReactNode
  accent?: string
}) {
  return (
    <section
      aria-labelledby={id}
      style={{
        background: PAPER,
        borderRadius: 2,
        boxShadow: ELEVATION[1],
        borderLeft: accent ? `4px solid ${accent}` : undefined,
        padding: '20px 24px',
        fontFamily: ROBOTO,
      }}
    >
      <h2
        id={id}
        style={{
          margin: '0 0 12px',
          fontFamily: ROBOTO,
          fontWeight: 300,
          fontSize: '1.5rem',
          color: INK.primary,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

// What a parent sees about the students they follow, in the same look as a
// student's own home: progress and pace in each class, this week's time,
// recent grades and anything worth a conversation.
export default function ObserverApp({
  config,
  now = new Date(),
}: {
  config: ObserverConfig
  now?: Date
}) {
  useMaterialPage()
  const [data, setData] = useState<ObserverData | null>(null)
  const [failed, setFailed] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)
  // What this parent has asked for this session (SelfPaced::LinkRequest).
  // Nothing loads these back in on a refresh; asking again just says so.
  const [requests, setRequests] = useState<LinkRequest[]>([])

  useEffect(() => {
    doFetchApi<ObserverData>({path: config.data_url})
      .then(({json}) => setData(json ?? null))
      .catch(() => setFailed(true))
  }, [config.data_url])

  const student = data?.students.find(s => s.id === chosen) ?? data?.students[0]
  const colors = useMemo(
    () =>
      classColors(
        (student?.courses ?? []).map(course => ({id: course.id, color: course.color})),
        {},
      ),
    [student],
  )

  if (failed) {
    return (
      <p style={{padding: 32, fontFamily: ROBOTO}}>
        {I18n.t("This page didn't load.")}{' '}
        <a href={config.classic_url}>{I18n.t('Open the classic dashboard')}</a>
      </p>
    )
  }
  if (!data) return <p style={{padding: 32, fontFamily: ROBOTO}}>{I18n.t('Loading...')}</p>

  const firstName = data.observer.name.split(' ')[0]
  const stripe =
    student && student.courses.length > 1 ? student.courses.map(c => colors[c.id]) : PALETTE

  return (
    <div style={{fontFamily: ROBOTO, background: SURFACE, minHeight: '100%', paddingBottom: 48}}>
      <header
        style={{
          background: ink(APP_BAR),
          color: '#fff',
          boxShadow: ELEVATION[4],
          borderRadius: '2px 2px 0 0',
          overflow: 'hidden',
        }}
      >
        <div aria-hidden="true" style={{display: 'flex', height: 6}}>
          {stripe.map((color, index) => (
            <span key={`${color}-${index}`} style={{flex: 1, background: color}} />
          ))}
        </div>
        <div style={{padding: '32px 32px 72px'}}>
          <div style={{opacity: 0.88}}>
            {now.toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})}
          </div>
          <h1
            style={{
              margin: '4px 0 12px',
              fontFamily: ROBOTO,
              fontWeight: 300,
              fontSize: 'clamp(2.5rem, 6vw, 4rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.5px',
              color: '#fff',
            }}
          >
            {greeting(firstName, now)}
          </h1>
          <p style={{margin: 0, fontSize: '1.125rem', opacity: 0.92}}>
            {data.students.length === 0
              ? I18n.t('Your students will show up here.')
              : data.students.length === 1
                ? I18n.t("Here's how %{student} is doing.", {student: data.students[0].short_name})
                : I18n.t('You follow %{count} students.', {count: data.students.length})}
          </p>
        </div>
      </header>

      <div style={{padding: '0 clamp(12px, 3vw, 32px)'}}>
        {student ? (
          <StudentView
            student={student}
            students={data.students}
            colors={colors}
            now={now}
            onChoose={setChosen}
          />
        ) : (
          <section
            data-testid="observer-empty"
            style={{
              background: PAPER,
              borderRadius: 2,
              boxShadow: ELEVATION[4],
              margin: '-40px 0 32px',
              padding: '28px 32px',
              position: 'relative',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontFamily: ROBOTO,
                fontWeight: 300,
                fontSize: '2rem',
                color: INK.primary,
              }}
            >
              {I18n.t('No students yet')}
            </h2>
            <p style={{margin: '12px 0 20px', color: INK.secondary, fontSize: '1.125rem'}}>
              {I18n.t(
                'When your student is in a self-paced class and their school links your account to them, their progress shows up here.',
              )}
            </p>
            <FindStudent
              searchUrl={config.search_url}
              requestsUrl={config.requests_url}
              requests={requests}
              onRequested={request => setRequests(prev => [request, ...prev])}
              onCancelled={id => setRequests(prev => prev.filter(request => request.id !== id))}
            />
          </section>
        )}
        <p style={{margin: '24px 0 0', textAlign: 'center'}}>
          <a href={config.classic_url} style={{color: INK.secondary}}>
            {I18n.t('Open the classic dashboard')}
          </a>
        </p>
      </div>
    </div>
  )
}

function StudentView({
  student,
  students,
  colors,
  now,
  onChoose,
}: {
  student: ObservedStudent
  students: ObservedStudent[]
  colors: Record<string, string>
  now: Date
  onChoose: (id: string) => void
}) {
  const average = student.courses.length
    ? Math.round(
        student.courses.reduce((sum, course) => sum + course.percent_complete, 0) /
          student.courses.length,
      )
    : 0
  const heroColor = student.courses[0] ? colors[student.courses[0].id] : APP_BAR

  return (
    <>
      <section
        aria-labelledby="ob-student"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
          background: PAPER,
          borderRadius: 2,
          boxShadow: ELEVATION[4],
          overflow: 'hidden',
          margin: '-40px 0 32px',
          position: 'relative',
        }}
      >
        <div style={{background: ink(heroColor), color: '#fff', padding: '28px 32px'}}>
          <div style={{opacity: 0.92}}>{I18n.t('Following')}</div>
          <h2
            id="ob-student"
            style={{
              margin: '4px 0 0',
              fontFamily: ROBOTO,
              fontWeight: 300,
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              lineHeight: 1.1,
              color: '#fff',
              overflowWrap: 'anywhere',
            }}
          >
            {student.name}
          </h2>
          {students.length > 1 && (
            <div
              role="tablist"
              aria-label={I18n.t('Students')}
              style={{display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap'}}
            >
              {students.map(s => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={s.id === student.id}
                  onClick={() => onChoose(s.id)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 16,
                    border: 'none',
                    background: s.id === student.id ? '#fff' : 'rgba(255,255,255,0.22)',
                    color: s.id === student.id ? ink(heroColor) : '#fff',
                    font: 'inherit',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {s.short_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            justifyContent: 'center',
          }}
        >
          <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
            <span style={{fontSize: '3rem', fontWeight: 300, lineHeight: 1, color: ink(heroColor)}}>
              {average}%
            </span>
            <span style={{color: INK.secondary}}>
              {I18n.t(
                {one: 'done across 1 class', other: 'done across %{count} classes'},
                {count: student.courses.length},
              )}
            </span>
          </div>
          <Progress
            percent={average}
            color={heroColor}
            label={I18n.t('Average progress across classes')}
          />
          <div style={{color: INK.secondary}}>
            {I18n.t('%{count} min this week', {count: student.time.week_minutes})}
          </div>
        </div>
      </section>

      {student.alerts.length > 0 && (
        <div style={{marginBottom: 24}}>
          <Panel id="ob-alerts" title={I18n.t('Worth a conversation')} accent="#EF6C00">
            <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
              {student.alerts.map(alert => (
                <li key={alert.id} style={{padding: '4px 0'}}>
                  <strong>{alert.course}:</strong> {alert.description}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {student.courses.length > 0 && (
        <>
          <h2
            style={{
              margin: '0 0 16px',
              fontFamily: ROBOTO,
              fontWeight: 300,
              fontSize: '2rem',
              color: INK.primary,
            }}
          >
            {I18n.t('Their classes')}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 19rem), 1fr))',
              gap: 20,
              marginBottom: 32,
            }}
          >
            {student.courses.map(course => (
              <CourseCard key={course.id} course={course} color={colors[course.id]} now={now} />
            ))}
          </div>
        </>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <TimePanel time={student.time} />
        <GradesPanel grades={student.grades} />
      </div>
    </>
  )
}

function CourseCard({course, color, now}: {course: CourseProgress; color: string; now: Date}) {
  const pace = paceText(course.pace)
  const headingId = `ob-course-${course.id}`
  return (
    <section
      aria-labelledby={headingId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: PAPER,
        borderRadius: 2,
        boxShadow: ELEVATION[2],
        overflow: 'hidden',
        fontFamily: ROBOTO,
      }}
    >
      <div
        style={{
          minHeight: 112,
          padding: '20px 20px 16px',
          background: ink(color),
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <h2
          id={headingId}
          style={{
            margin: 0,
            fontFamily: ROBOTO,
            fontWeight: 300,
            fontSize: '1.75rem',
            lineHeight: 1.15,
            color: '#fff',
            overflowWrap: 'anywhere',
          }}
        >
          {course.name}
        </h2>
        <div style={{marginTop: 4, opacity: 0.9, fontSize: '0.875rem'}}>{course.course_code}</div>
      </div>
      <div style={{padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
          <span
            style={{
              fontSize: '2.5rem',
              fontWeight: 300,
              lineHeight: 1,
              color: ink(color),
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {course.percent_complete}%
          </span>
          <span style={{color: INK.secondary}}>
            {I18n.t('%{done} of %{total} steps', {
              done: course.requirements_completed,
              total: course.requirements_total,
            })}
          </span>
        </div>
        <Progress
          percent={course.percent_complete}
          color={color}
          label={I18n.t('Progress in %{course}', {course: course.name})}
        />
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'center'}}>
          {pace && (
            <span
              style={{
                padding: '2px 10px',
                borderRadius: 12,
                background: pace.color,
                color: '#fff',
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              {pace.label}
            </span>
          )}
          <span style={{color: INK.secondary, fontSize: '0.875rem'}}>
            {agoText(course.last_active_at, now)}
          </span>
        </div>
        {course.pace?.target_date && (
          <div style={{color: INK.secondary, fontSize: '0.875rem'}}>
            {I18n.t('Planned finish: %{date}', {
              date: new Date(`${course.pace.target_date}T12:00:00`).toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function TimePanel({time}: {time: ObservedStudent['time']}) {
  const most = Math.max(1, ...time.daily.map(d => d.minutes))
  const change = time.week_minutes - time.previous_week_minutes
  return (
    <Panel id="ob-time" title={I18n.t('Time this week')}>
      <div style={{fontSize: '2.5rem', fontWeight: 300, lineHeight: 1}}>
        {I18n.t('%{count} min', {count: time.week_minutes})}
      </div>
      <div style={{color: INK.secondary, fontSize: '0.875rem', margin: '4px 0 12px'}}>
        {change === 0
          ? I18n.t('The same as last week')
          : change > 0
            ? I18n.t('%{count} min more than last week', {count: change})
            : I18n.t('%{count} min less than last week', {count: -change})}
      </div>
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 6, height: 72}}>
        {time.daily.map(day => (
          <div key={day.day} style={{flex: 1, textAlign: 'center'}}>
            <div
              title={I18n.t('%{count} min', {count: day.minutes})}
              style={{
                height: Math.max(2, (day.minutes / most) * 60),
                background: day.minutes > 0 ? ink(APP_BAR) : tint('#000000', 0.12),
              }}
            />
            <div style={{fontSize: '0.6875rem', color: INK.secondary, marginTop: 2}}>
              {new Date(`${day.day}T12:00:00`).toLocaleDateString(undefined, {weekday: 'narrow'})}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function GradesPanel({grades}: {grades: Grade[]}) {
  return (
    <Panel id="ob-grades" title={I18n.t('Recent grades')}>
      {grades.length === 0 ? (
        <p style={{margin: 0, color: INK.secondary}} data-testid="observer-no-grades">
          {I18n.t('No grades posted in the last 30 days.')}
        </p>
      ) : (
        <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
          {grades.map(grade => (
            <li
              key={grade.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '8px 0',
                borderTop: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{overflowWrap: 'anywhere'}}>{grade.title}</div>
                <div style={{color: INK.secondary, fontSize: '0.8125rem'}}>
                  {grade.course} ·{' '}
                  {new Date(grade.graded_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <div style={{fontWeight: 500, whiteSpace: 'nowrap'}}>
                {grade.points_possible
                  ? I18n.t('%{score} of %{points}', {
                      score: grade.score,
                      points: grade.points_possible,
                    })
                  : grade.score}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
