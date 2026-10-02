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
import {FlatButton, Pill, RaisedButton} from './bits'
import {headerColor, initials, statusLabel, teacherNames} from './catalogModel'
import {ELEVATION, INK, ROBOTO} from './material'
import type {CatalogCourse, Student} from './types'
import {ACCENT_TEXT, SUBTLE} from '@canvas/material'

const I18n = createI18nScope('course_catalog')

const STATUS_COLOR: Record<string, string> = {
  available: '#008300',
  completed: '#616161',
}

function Fact({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div style={{display: 'flex', gap: 8, fontSize: '0.875rem', lineHeight: 1.5}}>
      <span style={{color: INK.secondary, minWidth: 72}}>{label}</span>
      <span style={{color: INK.primary, minWidth: 0, overflowWrap: 'anywhere'}}>{children}</span>
    </div>
  )
}

// One course in the catalog: a colored header with its name, the facts an
// admin picks by (term, teachers, size, sub-account) and the way to open it
// or, with a student chosen, to enroll them.
export default function CourseCard({
  course,
  student,
  enrolled,
  onEnroll,
}: {
  course: CatalogCourse
  student: Student | null
  enrolled: boolean
  onEnroll: (course: CatalogCourse) => void
}) {
  const headingId = `cc-course-${course.id}`
  const teachers = teacherNames(course)
  const joinable = course.workflow_state !== 'completed'

  return (
    <section
      aria-labelledby={headingId}
      className="cc-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: SUBTLE,
        borderRadius: 2,
        boxShadow: ELEVATION[2],
        overflow: 'hidden',
        fontFamily: ROBOTO,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          minHeight: 88,
          padding: '16px 20px',
          background: headerColor(course),
          color: '#fff',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 500,
          }}
        >
          {initials(course.name)}
        </span>
        <div style={{minWidth: 0}}>
          <h2
            id={headingId}
            style={{
              margin: 0,
              fontFamily: ROBOTO,
              fontSize: '1.125rem',
              fontWeight: 500,
              lineHeight: 1.25,
              color: '#fff',
              overflowWrap: 'anywhere',
            }}
          >
            {course.name}
          </h2>
          {course.course_code && (
            <div style={{fontSize: '0.8125rem', opacity: 0.88}}>{course.course_code}</div>
          )}
        </div>
      </div>

      <div
        style={{display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 20px', flex: 1}}
      >
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8}}>
          <Pill color={STATUS_COLOR[course.workflow_state] ?? '#eb6834'}>
            {statusLabel(course.workflow_state)}
          </Pill>
          {course.blueprint && <Pill color="#4a3aa7">{I18n.t('Blueprint')}</Pill>}
          {enrolled && student && <Pill color="#2a78d6">{I18n.t('Already enrolled')}</Pill>}
        </div>
        {course.term?.name && <Fact label={I18n.t('Term')}>{course.term.name}</Fact>}
        <Fact label={I18n.t('Teachers')}>{teachers || I18n.t('None yet')}</Fact>
        <Fact label={I18n.t('Students')}>{course.total_students ?? 0}</Fact>
        {course.account_name && <Fact label={I18n.t('Account')}>{course.account_name}</Fact>}
      </div>

      <div style={{display: 'flex', gap: 8, padding: '8px 12px 12px', alignItems: 'center'}}>
        <a
          href={`/courses/${course.id}`}
          className="cc-flat"
          aria-label={I18n.t('Open %{course}', {course: course.name})}
          style={{
            padding: '9px 12px',
            borderRadius: 2,
            color: ACCENT_TEXT,
            fontSize: '0.875rem',
            fontWeight: 500,
            letterSpacing: '0.75px',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          {I18n.t('Open')}
        </a>
        <span style={{flex: 1}} />
        {student && !enrolled && (
          <RaisedButton
            disabled={!joinable}
            onClick={() => onEnroll(course)}
            aria-label={I18n.t('Enroll %{student} in %{course}', {
              student: student.name,
              course: course.name,
            })}
          >
            {I18n.t('Enroll')}
          </RaisedButton>
        )}
        {student && enrolled && (
          <FlatButton disabled color="#616161">
            {I18n.t('Enrolled')}
          </FlatButton>
        )}
      </div>
    </section>
  )
}
