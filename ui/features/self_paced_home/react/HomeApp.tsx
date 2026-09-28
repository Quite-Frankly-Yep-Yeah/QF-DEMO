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
import {Spinner} from '@instructure/ui-spinner'
import CourseCard from './CourseCard'
import {DueSoon, EmptyHero, Feedback, OtherClasses, ResumeHero} from './Panels'
import {APP_BAR, ELEVATION, INK, ink, PALETTE, ROBOTO, SURFACE, classColors} from './material'
import type {Home, HomeConfig} from './types'

const I18n = createI18nScope('self_paced_home')

export function greeting(name: string, now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return I18n.t('Good morning, %{name}', {name})
  if (hour < 18) return I18n.t('Good afternoon, %{name}', {name})
  return I18n.t('Good evening, %{name}', {name})
}

// The student's home in self-paced classes (docs/fork-plan.md): a greeting
// on the app bar, the class to pick up in, a card per class, what's due
// this week and recent feedback.
export default function HomeApp({config, now = new Date()}: {config: HomeConfig; now?: Date}) {
  const [home, setHome] = useState<Home | null>(null)
  const [failed, setFailed] = useState(false)
  const [custom, setCustom] = useState<Record<string, string>>({})

  useEffect(() => {
    doFetchApi<Home>({path: config.home_url})
      .then(({json}) => setHome(json ?? null))
      .catch(() => setFailed(true))
    doFetchApi<{custom_colors: Record<string, string>}>({path: '/api/v1/users/self/colors'})
      .then(({json}) => setCustom(json?.custom_colors ?? {}))
      .catch(() => {})
  }, [config.home_url])

  const colors = useMemo(
    () => (home ? classColors([...home.courses, ...home.other_courses], custom) : {}),
    [home, custom],
  )
  const names = useMemo(
    () => Object.fromEntries((home?.courses ?? []).map(course => [course.id, course.name])),
    [home],
  )

  if (failed) {
    return (
      <p style={{padding: 32, fontFamily: ROBOTO}}>
        {I18n.t("Your home page didn't load.")}{' '}
        <a href={config.classic_url}>{I18n.t('Open the classic dashboard')}</a>
      </p>
    )
  }
  if (!home) {
    return (
      <div style={{textAlign: 'center', padding: 64}}>
        <Spinner renderTitle={I18n.t('Loading your classes')} />
      </div>
    )
  }

  const resume = home.courses.find(course => course.id === home.resume_course_id) ?? home.courses[0]
  const todayItems = home.courses.reduce(
    (sum, course) => ({
      done: sum.done + (course.pace?.today.done ?? 0),
      total: sum.total + (course.pace?.today.total ?? 0),
    }),
    {done: 0, total: 0},
  )

  return (
    <div style={{fontFamily: ROBOTO, background: SURFACE, minHeight: '100%', paddingBottom: 48}}>
      <style>{`.sp-home-raised:hover { box-shadow: ${ELEVATION[8]} !important; }
.sp-home-raised:focus-visible { outline: 2px solid #fff; outline-offset: 2px; box-shadow: 0 0 0 4px rgba(0,0,0,0.6) !important; }`}</style>
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
          {home.courses.length > 1
            ? home.courses.map(course => (
                <span key={course.id} style={{flex: 1, background: colors[course.id]}} />
              ))
            : PALETTE.map(color => <span key={color} style={{flex: 1, background: color}} />)}
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
            {greeting(home.student.short_name, now)}
          </h1>
          <p style={{margin: 0, fontSize: '1.125rem', opacity: 0.92}}>
            {home.courses.length === 0
              ? I18n.t('Welcome. Your classes will show up here.')
              : todayItems.total === 0
                ? I18n.t(
                    {one: 'You have 1 class.', other: 'You have %{count} classes.'},
                    {count: home.courses.length},
                  )
                : todayItems.done >= todayItems.total
                  ? I18n.t("You've done everything planned for today. Nice work.")
                  : I18n.t('%{done} of %{total} items planned for today are done.', {
                      done: todayItems.done,
                      total: todayItems.total,
                    })}
          </p>
        </div>
      </header>

      <div style={{padding: '0 clamp(12px, 3vw, 32px)'}}>
        {resume ? (
          <ResumeHero course={resume} color={colors[resume.id]} />
        ) : (
          <EmptyHero hasOtherClasses={home.other_courses.length > 0} />
        )}

        {home.courses.length > 0 && (
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
              {I18n.t('Your classes')}
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 19rem), 1fr))',
                gap: 20,
                marginBottom: 32,
              }}
            >
              {home.courses.map(course => (
                <CourseCard key={course.id} course={course} color={colors[course.id]} />
              ))}
            </div>
          </>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))',
            gap: 20,
            marginBottom: 20,
          }}
        >
          <DueSoon items={home.due_soon} colors={colors} names={names} />
          <Feedback items={home.feedback} colors={colors} names={names} />
        </div>
        <OtherClasses courses={home.other_courses} colors={colors} />
        <p style={{margin: '24px 0 0', textAlign: 'center'}}>
          <a href={config.classic_url} style={{color: INK.secondary}}>
            {I18n.t('Open the classic dashboard')}
          </a>
        </p>
      </div>
    </div>
  )
}
