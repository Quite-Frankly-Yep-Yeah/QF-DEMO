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
import type {CourseHomeConfig, Link, Stats, Step, Unit} from './types'
import {DANGER, DIVIDER, INK, PAPER, WARNING} from '@canvas/material'
import {useMaterialPage} from '@canvas/material/useMaterialPage'

const I18n = createI18nScope('self_paced_course_home')

const ROBOTO = "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const DEFAULT_COLOR = '#1565C0'
const ELEVATION = {
  1: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
  4: '0 2px 5px rgba(0,0,0,0.26), 0 2px 10px rgba(0,0,0,0.16)',
  8: '0 4px 8px rgba(0,0,0,0.28), 0 4px 20px rgba(0,0,0,0.2)',
}

const STYLES = `
.sp-ch-tile:hover { box-shadow: ${ELEVATION[8]} !important; }
.sp-ch-tile:focus-visible, .sp-ch-row:focus-visible { outline: 2px solid #212121; outline-offset: 2px; }
.sp-ch-row:hover { background: rgba(0,0,0,0.04); }
`

function card(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: PAPER,
    borderRadius: 2,
    boxShadow: ELEVATION[1],
    fontFamily: ROBOTO,
    ...extra,
  }
}

function Heading({id, children}: {id: string; children: React.ReactNode}) {
  return (
    <h2
      id={id}
      style={{
        margin: '0 0 16px',
        fontFamily: ROBOTO,
        fontWeight: 300,
        fontSize: '1.75rem',
        color: INK.primary,
      }}
    >
      {children}
    </h2>
  )
}

// The home of a self-paced course for the people who run it: how the class is
// doing, what is left to set up, the units, and the places they go next.
export default function CourseHomeApp({config}: {config: CourseHomeConfig}) {
  useMaterialPage()
  const {course, checklist, units, stats, links} = config
  const color = course.color || DEFAULT_COLOR
  const remaining = checklist.filter(step => !step.done)

  return (
    <div style={{fontFamily: ROBOTO, paddingBottom: 48}}>
      <style>{STYLES}</style>
      <header
        style={{
          background: color,
          color: '#fff',
          borderRadius: '2px 2px 0 0',
          boxShadow: ELEVATION[4],
          padding: '32px 32px 88px',
        }}
      >
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center'}}>
          <span
            style={{
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: '0.8125rem',
              fontWeight: 500,
              background: 'rgba(255,255,255,0.22)',
            }}
          >
            {course.published ? I18n.t('Published') : I18n.t('Not published')}
          </span>
          <span style={{opacity: 0.9}}>{course.course_code}</span>
          <span style={{flex: 1}} />
          <a href={config.classic_url} style={{color: '#fff', opacity: 0.9}}>
            {I18n.t('Standard course home')}
          </a>
        </div>
        <h1
          style={{
            margin: '12px 0 0',
            fontFamily: ROBOTO,
            fontWeight: 300,
            fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
            lineHeight: 1.1,
            color: '#fff',
            overflowWrap: 'anywhere',
          }}
        >
          {course.name}
        </h1>
      </header>

      <div style={{padding: '0 clamp(12px, 3vw, 32px)'}}>
        <ClassAtAGlance stats={stats} links={links.class} />

        {remaining.length > 0 && <Checklist steps={checklist} />}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))',
            gap: 20,
            alignItems: 'start',
          }}
        >
          <UnitsCard units={units} addUrl={links.manage.find(l => l.id === 'modules')?.url} />
          <div>
            <Tiles id="ch-make" title={I18n.t('Make something')} links={links.make} color={color} />
            <Tiles
              id="ch-manage"
              title={I18n.t('Run the course')}
              links={links.manage}
              color={color}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ClassAtAGlance({stats, links}: {stats: Stats | null; links: Link[]}) {
  return (
    <section
      aria-labelledby="ch-class"
      style={card({boxShadow: ELEVATION[4], margin: '-56px 0 24px', padding: '24px 32px'})}
    >
      <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 16}}>
        <Heading id="ch-class">{I18n.t('Your class')}</Heading>
        <span style={{flex: 1}} />
        {links.map(link => (
          <a key={link.id} href={link.url} style={{fontWeight: 500}}>
            {link.label}
          </a>
        ))}
      </div>
      {stats === null ? (
        <p
          style={{margin: 0, color: INK.secondary, fontSize: '1.125rem'}}
          data-testid="ch-no-students"
        >
          {I18n.t('No students yet. Add students and their progress shows up here.')}
        </p>
      ) : (
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '16px 40px'}}>
          <Stat value={String(stats.students)} label={I18n.t('students')} />
          <Stat
            value={`${stats.average_percent}%`}
            label={I18n.t('done on average')}
            bar={stats.average_percent}
          />
          <Stat
            value={String(stats.behind)}
            label={I18n.t('behind pace')}
            warn={stats.behind > 0}
          />
          <Stat value={String(stats.stuck)} label={I18n.t('stuck')} warn={stats.stuck > 0} />
          <Stat
            value={String(stats.inactive)}
            label={I18n.t('inactive')}
            warn={stats.inactive > 0}
          />
        </div>
      )}
    </section>
  )
}

function Stat({
  value,
  label,
  warn,
  bar,
}: {
  value: string
  label: string
  warn?: boolean
  bar?: number
}) {
  return (
    <div style={{minWidth: 96}}>
      <div
        style={{
          fontSize: '3rem',
          fontWeight: 300,
          lineHeight: 1,
          color: warn ? DANGER : INK.primary,
        }}
      >
        {value}
      </div>
      <div style={{color: INK.secondary}}>{label}</div>
      {bar !== undefined && (
        <div
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={bar}
          style={{height: 4, marginTop: 8, background: DIVIDER}}
        >
          <div style={{height: '100%', width: `${bar}%`, background: '#2E7D32'}} />
        </div>
      )}
    </div>
  )
}

function Checklist({steps}: {steps: Step[]}) {
  const done = steps.filter(step => step.done).length
  return (
    <section aria-labelledby="ch-start" style={card({margin: '0 0 24px', padding: '24px 32px'})}>
      <Heading id="ch-start">
        {I18n.t('Get the class ready')}{' '}
        <span style={{fontSize: '1rem', color: INK.secondary}}>
          {I18n.t('%{done} of %{total} done', {done, total: steps.length})}
        </span>
      </Heading>
      <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
        {steps.map(step => (
          <li key={step.id}>
            <a
              href={step.url}
              className="sp-ch-row"
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '10px 8px',
                color: step.done ? INK.secondary : INK.primary,
                textDecoration: step.done ? 'line-through' : 'none',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: `2px solid ${step.done ? '#2E7D32' : '#9E9E9E'}`,
                  background: step.done ? '#2E7D32' : 'transparent',
                  color: '#fff',
                  fontSize: 14,
                  lineHeight: '18px',
                  textAlign: 'center',
                }}
              >
                {step.done ? '✓' : ''}
              </span>
              <span>{step.label}</span>
              <span className="screenreader-only">
                {step.done ? I18n.t('(done)') : I18n.t('(to do)')}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function UnitsCard({units, addUrl}: {units: Unit[]; addUrl?: string}) {
  return (
    <section aria-labelledby="ch-units" style={card({padding: '24px 32px 16px'})}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
        <Heading id="ch-units">{I18n.t('Units')}</Heading>
        <span style={{flex: 1}} />
        {addUrl && (
          <a href={addUrl} style={{fontWeight: 500}}>
            {I18n.t('Edit units')}
          </a>
        )}
      </div>
      {units.length === 0 ? (
        <p style={{margin: '0 0 16px', color: INK.secondary}} data-testid="ch-no-units">
          {I18n.t(
            'No units yet. A unit is a group of lessons and practice students work through in order.',
          )}
        </p>
      ) : (
        <ol style={{listStyle: 'none', margin: 0, padding: 0}}>
          {units.map((unit, index) => (
            <li key={unit.id}>
              <a
                href={unit.url}
                className="sp-ch-row"
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                  padding: '12px 8px',
                  color: INK.primary,
                  borderTop: index === 0 ? undefined : '1px solid rgba(0,0,0,0.08)',
                }}
              >
                <span
                  style={{fontSize: '1.5rem', fontWeight: 300, width: 28, color: INK.secondary}}
                >
                  {index + 1}
                </span>
                <span style={{flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontWeight: 500}}>
                  {unit.name}
                </span>
                <span style={{color: INK.secondary, fontSize: '0.875rem', textAlign: 'right'}}>
                  {I18n.t({one: '1 item', other: '%{count} items'}, {count: unit.items})}
                  {unit.quizzes > 0 &&
                    `, ${I18n.t({one: '1 quiz', other: '%{count} quizzes'}, {count: unit.quizzes})}`}
                  {(!unit.published || unit.unpublished_items > 0) && (
                    <span style={{display: 'block', color: WARNING}}>
                      {unit.published
                        ? I18n.t('%{count} not published', {count: unit.unpublished_items})
                        : I18n.t('Not published')}
                    </span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Tiles({
  id,
  title,
  links,
  color,
}: {
  id: string
  title: string
  links: Link[]
  color: string
}) {
  if (links.length === 0) return null
  return (
    <section aria-labelledby={id} style={{marginBottom: 24}}>
      <Heading id={id}>{title}</Heading>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
          gap: 12,
        }}
      >
        {links.map(link => (
          <a
            key={link.id}
            href={link.url}
            className="sp-ch-tile"
            style={card({
              display: 'block',
              padding: '16px',
              borderTop: `4px solid ${color}`,
              color: INK.primary,
              fontWeight: 500,
              textDecoration: 'none',
            })}
          >
            {link.label}
          </a>
        ))}
      </div>
    </section>
  )
}
