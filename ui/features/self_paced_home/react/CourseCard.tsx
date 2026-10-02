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
import {ELEVATION, INK, ink, ROBOTO, tint} from './material'
import type {HomeCourse} from './types'
import {PAPER} from '@canvas/material'

const I18n = createI18nScope('self_paced_home')

// A raised Material button: white on a color, or the color on white.
export function RaisedLink({
  href,
  color,
  inverse = false,
  children,
  label,
}: {
  href: string
  color: string
  inverse?: boolean
  children: React.ReactNode
  label?: string
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="sp-home-raised"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 20px',
        borderRadius: 2,
        background: inverse ? '#fff' : ink(color),
        color: inverse ? ink(color) : '#fff',
        fontFamily: ROBOTO,
        fontSize: '0.875rem',
        fontWeight: 500,
        letterSpacing: '0.75px',
        textTransform: 'uppercase',
        textDecoration: 'none',
        boxShadow: ELEVATION[2],
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </a>
  )
}

// A thin bar in the class's color.
export function Progress({
  percent,
  color,
  label,
  track,
  fill,
}: {
  percent: number
  color: string
  label: string
  track?: string
  fill?: string
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      style={{
        height: 6,
        background: track ?? tint(color, 0.2),
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <div style={{width: `${value}%`, height: '100%', background: fill ?? color}} />
    </div>
  )
}

export function todayText(pace: NonNullable<HomeCourse['pace']>): string {
  if (pace.finished) return I18n.t('All the work is done.')
  if (pace.today.total === 0) return I18n.t('Nothing planned for today.')
  if (pace.today.done >= pace.today.total) return I18n.t("Today's goal is done.")
  return I18n.t("Today's goal: %{done} of %{total} items (%{minutes} min planned)", {
    done: pace.today.done,
    total: pace.today.total,
    minutes: pace.today.minutes,
  })
}

// One class: a colored header with its name, then progress, pace, today's
// goal and the way back in.
export default function CourseCard({course, color}: {course: HomeCourse; color: string}) {
  const headingId = `sp-home-course-${course.id}`
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
          position: 'relative',
          minHeight: 112,
          padding: '20px 20px 16px',
          background: ink(color),
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        {course.image_url && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("${course.image_url}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.18,
            }}
          />
        )}
        <h2
          id={headingId}
          style={{
            position: 'relative',
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
        <div style={{position: 'relative', marginTop: 4, opacity: 0.9, fontSize: '0.875rem'}}>
          {course.course_code}
        </div>
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
          <span style={{color: INK.secondary}}>{I18n.t('done')}</span>
          {course.score !== null && (
            <span style={{marginLeft: 'auto', color: INK.secondary, fontSize: '0.875rem'}}>
              {I18n.t('Grade %{score}%', {score: Math.round(course.score)})}
            </span>
          )}
        </div>
        <Progress
          percent={course.percent_complete}
          color={color}
          label={I18n.t('Progress in %{course}', {course: course.name})}
        />
        {course.pace && (
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <div>
              <PaceBadge daysAhead={course.pace.days_ahead} finished={course.pace.finished} />
            </div>
            <div style={{color: INK.primary}}>{todayText(course.pace)}</div>
          </div>
        )}
        {course.continue && (
          <div style={{color: INK.secondary, fontSize: '0.875rem', overflowWrap: 'anywhere'}}>
            {I18n.t('Next up: %{title}', {title: course.continue.title})}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            marginTop: 'auto',
            paddingTop: 4,
          }}
        >
          <RaisedLink
            href={course.continue?.url ?? course.url}
            color={color}
            label={I18n.t('Continue %{course}', {course: course.name})}
          >
            {I18n.t('Continue')}
          </RaisedLink>
          <a href={course.url} style={{color: ink(color), fontWeight: 500}}>
            {I18n.t('Course map')}
          </a>
        </div>
      </div>
    </section>
  )
}
