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

import React from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import PaceBadge from '@canvas/self-paced/react/PaceBadge'
import {Progress, RaisedLink, todayText} from './CourseCard'
import {ELEVATION, INK, ink, ROBOTO, tint} from './material'
import type {DueItem, FeedbackItem, Home, HomeCourse} from './types'
import {DIVIDER, PAPER} from '@canvas/material'

const I18n = createI18nScope('self_paced_home')

// "Pick up where you left off": the class worked on most recently, in its
// own color, with the next item's name set big.
export function ResumeHero({course, color}: {course: HomeCourse; color: string}) {
  const next = course.continue
  return (
    <section
      aria-labelledby="sp-home-resume"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
        background: PAPER,
        borderRadius: 2,
        boxShadow: ELEVATION[4],
        overflow: 'hidden',
        margin: '-40px 0 32px',
        position: 'relative',
        fontFamily: ROBOTO,
      }}
    >
      <div style={{background: ink(color), color: '#fff', padding: '28px 32px'}}>
        <h2
          id="sp-home-resume"
          style={{
            margin: 0,
            fontFamily: ROBOTO,
            fontWeight: 400,
            fontSize: '1rem',
            color: '#fff',
            opacity: 0.92,
          }}
        >
          {I18n.t('Pick up where you left off')}
        </h2>
        <div style={{marginTop: 16, fontSize: '1.125rem', opacity: 0.92}}>
          {next?.module
            ? I18n.t('%{course}, %{module}', {course: course.name, module: next.module})
            : course.name}
        </div>
        <div
          style={{
            marginTop: 4,
            fontWeight: 300,
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            lineHeight: 1.1,
            overflowWrap: 'anywhere',
          }}
        >
          {next?.title ?? course.name}
        </div>
        <div style={{marginTop: 24}}>
          <RaisedLink href={next?.url ?? course.url} color={color} inverse={true}>
            {I18n.t('Continue')}
          </RaisedLink>
        </div>
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
          <span style={{fontSize: '3rem', fontWeight: 300, lineHeight: 1, color: ink(color)}}>
            {course.percent_complete}%
          </span>
          <span style={{color: INK.secondary}}>
            {I18n.t('of %{course} done', {course: course.name})}
          </span>
        </div>
        <Progress
          percent={course.percent_complete}
          color={color}
          label={I18n.t('Course progress')}
        />
        {course.pace && (
          <>
            <div>
              <PaceBadge daysAhead={course.pace.days_ahead} finished={course.pace.finished} />
            </div>
            <div style={{color: INK.primary}}>{todayText(course.pace)}</div>
          </>
        )}
      </div>
    </section>
  )
}

function Panel({title, id, children}: {title: string; id: string; children: React.ReactNode}) {
  return (
    <section
      aria-labelledby={id}
      style={{
        background: PAPER,
        borderRadius: 2,
        boxShadow: ELEVATION[1],
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
          fontSize: '1.75rem',
          color: INK.primary,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

const ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '3.5rem 1fr',
  gap: 14,
  alignItems: 'center',
  padding: '10px 0',
  borderTop: `1px solid ${DIVIDER}`,
}

// A square date tile in the class's color: weekday over day of month.
function DateTile({iso, color}: {iso: string; color: string}) {
  const date = new Date(iso)
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '3.5rem',
        borderRadius: 2,
        background: ink(color),
        color: '#fff',
        lineHeight: 1.1,
      }}
    >
      <span style={{fontSize: '0.75rem', opacity: 0.9}}>
        {date.toLocaleDateString(undefined, {weekday: 'short'})}
      </span>
      <span style={{fontSize: '1.5rem', fontWeight: 300}}>{date.getDate()}</span>
    </span>
  )
}

export function DueSoon({
  items,
  colors,
  names,
}: {
  items: DueItem[]
  colors: Record<string, string>
  names: Record<string, string>
}) {
  return (
    <Panel title={I18n.t('Due this week')} id="sp-home-due">
      {items.length === 0 ? (
        <p style={{margin: 0, color: INK.secondary}}>{I18n.t('Nothing due in the next 7 days.')}</p>
      ) : (
        <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
          {items.map(item => (
            <li key={item.id} style={ROW}>
              <DateTile iso={item.due_at} color={colors[item.course_id] ?? '#37474f'} />
              <span style={{minWidth: 0}}>
                <a
                  href={item.url}
                  style={{color: INK.primary, fontWeight: 500, overflowWrap: 'anywhere'}}
                >
                  {item.title}
                </a>
                <span style={{display: 'block', color: INK.secondary, fontSize: '0.875rem'}}>
                  {I18n.t('%{course}, due %{time}', {
                    course: names[item.course_id] ?? '',
                    time: new Date(item.due_at).toLocaleString(undefined, {
                      weekday: 'long',
                      hour: 'numeric',
                      minute: '2-digit',
                    }),
                  })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function Feedback({
  items,
  colors,
  names,
}: {
  items: FeedbackItem[]
  colors: Record<string, string>
  names: Record<string, string>
}) {
  return (
    <Panel title={I18n.t('Recent feedback')} id="sp-home-feedback">
      {items.length === 0 ? (
        <p style={{margin: 0, color: INK.secondary}}>
          {I18n.t('No new grades in the last two weeks.')}
        </p>
      ) : (
        <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
          {items.map(item => {
            const color = colors[item.course_id] ?? '#37474f'
            return (
              <li key={item.id} style={ROW}>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '3.5rem',
                    borderRadius: '50%',
                    background: tint(color, 0.14),
                    color: ink(color),
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {item.points_possible
                    ? `${Math.round((item.score / item.points_possible) * 100)}%`
                    : item.score}
                </span>
                <span style={{minWidth: 0}}>
                  <a
                    href={item.url}
                    style={{color: INK.primary, fontWeight: 500, overflowWrap: 'anywhere'}}
                  >
                    {item.title}
                  </a>
                  <span style={{display: 'block', color: INK.secondary, fontSize: '0.875rem'}}>
                    {item.points_possible
                      ? I18n.t('%{course}: %{score} out of %{possible}', {
                          course: names[item.course_id] ?? '',
                          score: item.score,
                          possible: item.points_possible,
                        })
                      : I18n.t('%{course}: %{score} points', {
                          course: names[item.course_id] ?? '',
                          score: item.score,
                        })}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export function OtherClasses({
  courses,
  colors,
}: {
  courses: Home['other_courses']
  colors: Record<string, string>
}) {
  if (courses.length === 0) return null
  return (
    <Panel title={I18n.t('Other classes')} id="sp-home-other">
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
        {courses.map(course => (
          <li key={course.id}>
            <a
              href={course.url}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 16,
                background: tint(colors[course.id] ?? '#37474f', 0.14),
                color: INK.primary,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              <span
                aria-hidden="true"
                style={{width: 10, height: 10, borderRadius: 3, background: colors[course.id]}}
              />
              {course.name}
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// A student with nothing to pick up: the same raised card as the resume card,
// saying why and what happens next.
export function EmptyHero({hasOtherClasses}: {hasOtherClasses: boolean}) {
  return (
    <section
      aria-labelledby="sp-home-empty"
      data-testid="sp-home-empty"
      style={{
        background: PAPER,
        borderRadius: 2,
        boxShadow: ELEVATION[4],
        margin: '-40px 0 32px',
        padding: '28px 32px',
        position: 'relative',
        fontFamily: ROBOTO,
      }}
    >
      <h2
        id="sp-home-empty"
        style={{
          margin: 0,
          fontFamily: ROBOTO,
          fontWeight: 300,
          fontSize: '2rem',
          color: INK.primary,
        }}
      >
        {hasOtherClasses
          ? I18n.t('None of your classes are self-paced')
          : I18n.t("You aren't enrolled in any classes yet")}
      </h2>
      <p style={{margin: '12px 0 0', color: INK.secondary, fontSize: '1.125rem'}}>
        {hasOtherClasses
          ? I18n.t('Your classes are listed below. Open one to get started.')
          : I18n.t(
              'When a teacher adds you to a class, it shows up here with your progress and what to do next.',
            )}
      </p>
    </section>
  )
}
