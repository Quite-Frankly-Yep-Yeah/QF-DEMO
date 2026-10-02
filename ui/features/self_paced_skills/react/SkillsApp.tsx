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

import React, {useCallback, useEffect, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import type {Level, Skill, SkillsConfig, SkillsData} from './types'
import {DANGER, DANGER_BG, DIVIDER, INK, PAPER} from '@canvas/material'
import {useMaterialPage} from '@canvas/material/useMaterialPage'

const I18n = createI18nScope('self_paced_skills')

const ROBOTO = "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const DEFAULT_COLOR = '#1565C0'
const ELEVATION = {
  1: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
  4: '0 2px 5px rgba(0,0,0,0.26), 0 2px 10px rgba(0,0,0,0.16)',
}

const LEVELS: {level: Level; color: string; label: () => string}[] = [
  {level: 'mastered', color: '#2E7D32', label: () => I18n.t('Mastered')},
  {level: 'almost', color: '#F9A825', label: () => I18n.t('Almost there')},
  {level: 'building', color: '#EF6C00', label: () => I18n.t('Still building')},
  {level: 'not_assessed', color: '#BDBDBD', label: () => I18n.t('Not started')},
]

const levelSpec = (level: Level) => LEVELS.find(l => l.level === level)!

const total = (skill: Skill) => LEVELS.reduce((sum, l) => sum + skill.counts[l.level], 0)

// Assessed for someone, and fewer than half of those have mastered it.
export function needsAttention(skill: Skill): boolean {
  const assessed = skill.counts.mastered + skill.counts.almost + skill.counts.building
  return assessed > 0 && skill.counts.mastered * 2 < assessed
}

function card(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: PAPER,
    borderRadius: 2,
    boxShadow: ELEVATION[1],
    fontFamily: ROBOTO,
    ...extra,
  }
}

const buttonStyle = (color: string): React.CSSProperties => ({
  padding: '6px 14px',
  border: 'none',
  borderRadius: 2,
  background: color,
  color: '#fff',
  fontFamily: ROBOTO,
  fontSize: '0.8125rem',
  fontWeight: 500,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
})

// What each student can do, skill by skill. Replaces the outcomes page for
// staff of a Course Player course.
export default function SkillsApp({config}: {config: SkillsConfig}) {
  useMaterialPage()
  const color = config.course.color || DEFAULT_COLOR
  const [data, setData] = useState<SkillsData | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const {json} = await doFetchApi<SkillsData>({path: config.skills_url})
      setData(json ?? null)
      setError('')
    } catch {
      setError(I18n.t("The skills didn't load."))
    }
  }, [config.skills_url])

  useEffect(() => {
    load()
  }, [load])

  if (!data) {
    return (
      <p style={{padding: 32, fontFamily: ROBOTO}} role={error ? 'alert' : undefined}>
        {error || I18n.t('Loading skills...')}
      </p>
    )
  }

  // the ones that need help first
  const skills = [...data.skills].sort(
    (a, b) =>
      Number(needsAttention(b)) - Number(needsAttention(a)) || a.title.localeCompare(b.title),
  )
  const {summary} = data

  return (
    <div style={{fontFamily: ROBOTO, paddingBottom: 48}}>
      <header
        style={{
          background: color,
          color: '#fff',
          borderRadius: '2px 2px 0 0',
          boxShadow: ELEVATION[4],
          padding: '28px 32px 72px',
        }}
      >
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 16, opacity: 0.92}}>
          <a href={config.home_url} style={{color: '#fff'}}>
            {config.course.name}
          </a>
          <span style={{flex: 1}} />
          <a href={config.classic_url} style={{color: '#fff'}}>
            {I18n.t('Standard outcomes page')}
          </a>
        </div>
        <h1
          style={{
            margin: '8px 0 0',
            fontFamily: ROBOTO,
            fontWeight: 300,
            fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
            lineHeight: 1.1,
            color: '#fff',
          }}
        >
          {I18n.t('Skills')}
        </h1>
        <p style={{margin: '8px 0 0', fontSize: '1.125rem', opacity: 0.92}}>
          {I18n.t('What each student can do, one skill at a time.')}
        </p>
      </header>

      <div style={{padding: '0 clamp(12px, 3vw, 32px)', maxWidth: '64rem'}}>
        <section
          aria-label={I18n.t('Summary')}
          style={card({
            boxShadow: ELEVATION[4],
            margin: '-40px 0 24px',
            padding: '16px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 40px',
          })}
        >
          <Stat value={String(data.skills.length)} label={I18n.t('skills')} />
          <Stat value={String(data.students)} label={I18n.t('students')} />
          <Stat
            value={summary.mastered_percent === null ? '–' : `${summary.mastered_percent}%`}
            label={I18n.t('of assessed skills mastered')}
          />
          <Stat
            value={String(summary.needing_attention)}
            label={I18n.t('need attention')}
            warn={summary.needing_attention > 0}
          />
        </section>

        {config.can_add && <AddSkill url={config.skills_url} color={color} onAdded={load} />}

        {data.skills.length === 0 ? (
          <p data-testid="skills-empty" style={{color: INK.secondary, fontSize: '1.125rem'}}>
            {I18n.t(
              'No skills yet. A skill is one thing a student should be able to do, like "add fractions with unlike denominators". Add your first one, then align quizzes and assignments to it so results show up here.',
            )}
          </p>
        ) : (
          skills.map(skill => (
            <SkillCard key={skill.id} skill={skill} courseId={config.course.id} color={color} />
          ))
        )}
      </div>
    </div>
  )
}

function Stat({value, label, warn}: {value: string; label: string; warn?: boolean}) {
  return (
    <div>
      <div
        style={{
          fontSize: '2.5rem',
          fontWeight: 300,
          lineHeight: 1,
          color: warn ? DANGER : INK.primary,
        }}
      >
        {value}
      </div>
      <div style={{color: INK.secondary}}>{label}</div>
    </div>
  )
}

function AddSkill({url, color, onAdded}: {url: string; color: string; onAdded: () => void}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    try {
      await doFetchApi({path: url, method: 'POST', body: {title, description}})
      setTitle('')
      setDescription('')
      setOpen(false)
      setMessage(I18n.t('Added the skill.'))
      onAdded()
    } catch {
      setMessage(I18n.t("The skill didn't save. Check the name and try again."))
    }
  }

  return (
    <section
      aria-label={I18n.t('Add a skill')}
      style={card({padding: '12px 24px', margin: '0 0 20px'})}
    >
      {open ? (
        <form onSubmit={submit} style={{display: 'grid', gap: 8}}>
          <label>
            <span style={{display: 'block', fontWeight: 500}}>{I18n.t('Skill name')}</span>
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              style={{width: '100%', padding: '6px 8px', boxSizing: 'border-box'}}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={true}
            />
          </label>
          <label>
            <span style={{display: 'block', fontWeight: 500}}>
              {I18n.t('What a student can do (optional)')}
            </span>
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              style={{width: '100%', padding: '6px 8px', boxSizing: 'border-box', minHeight: 60}}
            />
          </label>
          <div style={{display: 'flex', gap: 8}}>
            <button type="submit" style={buttonStyle(color)}>
              {I18n.t('Add skill')}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={buttonStyle('#757575')}>
              {I18n.t('Cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <button type="button" onClick={() => setOpen(true)} style={buttonStyle(color)}>
            {I18n.t('Add a skill')}
          </button>
          <span role="status" style={{color: INK.secondary}}>
            {message}
          </span>
        </div>
      )}
    </section>
  )
}

function SkillCard({skill, courseId, color}: {skill: Skill; courseId: string; color: string}) {
  const [showStudents, setShowStudents] = useState(false)
  const [showItems, setShowItems] = useState(false)
  const headingId = `skill-${skill.id}`
  const count = total(skill)
  const attention = needsAttention(skill)
  const summary = LEVELS.map(l => `${skill.counts[l.level]} ${l.label().toLowerCase()}`).join(', ')

  return (
    <section
      aria-labelledby={headingId}
      style={card({
        borderLeft: `4px solid ${attention ? '#C62828' : color}`,
        margin: '0 0 20px',
        padding: '16px 24px',
      })}
    >
      <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12}}>
        <h2
          id={headingId}
          style={{
            margin: 0,
            fontFamily: ROBOTO,
            fontWeight: 400,
            fontSize: '1.375rem',
            color: INK.primary,
            overflowWrap: 'anywhere',
          }}
        >
          {skill.title}
        </h2>
        {attention && (
          <span
            style={{
              padding: '2px 10px',
              borderRadius: 12,
              background: DANGER_BG,
              color: DANGER,
              fontSize: '0.8125rem',
              fontWeight: 500,
            }}
          >
            {I18n.t('Needs attention')}
          </span>
        )}
      </div>
      {skill.description && (
        <p style={{margin: '4px 0 12px', color: INK.secondary}}>{skill.description}</p>
      )}

      <div
        role="img"
        aria-label={summary}
        style={{display: 'flex', height: 12, background: DIVIDER, margin: '12px 0 8px'}}
      >
        {count > 0 &&
          LEVELS.map(l =>
            skill.counts[l.level] > 0 ? (
              <span
                key={l.level}
                style={{width: `${(skill.counts[l.level] * 100) / count}%`, background: l.color}}
              />
            ) : null,
          )}
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 20px',
          fontSize: '0.875rem',
        }}
      >
        {LEVELS.map(l => (
          <li key={l.level} style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <span aria-hidden="true" style={{width: 10, height: 10, background: l.color}} />
            {l.label()}: {skill.counts[l.level]}
          </li>
        ))}
      </ul>

      {skill.lessons.length > 0 && (
        <p data-testid="skill-test-out" style={{margin: '12px 0 0', color: INK.secondary}}>
          {I18n.t(
            {
              one: 'Students who master this skill skip 1 lesson.',
              other: 'Students who master this skill skip %{count} lessons.',
            },
            {count: skill.lessons.length},
          )}{' '}
          {skill.tested_out > 0 &&
            I18n.t(
              {
                one: '1 student has tested out.',
                other: '%{count} students have tested out.',
              },
              {count: skill.tested_out},
            )}
        </p>
      )}

      <div style={{display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12}}>
        <button
          type="button"
          onClick={() => setShowStudents(show => !show)}
          aria-expanded={showStudents}
          style={linkButton}
        >
          {showStudents ? I18n.t('Hide students') : I18n.t('Show students')}
        </button>
        <button
          type="button"
          onClick={() => setShowItems(show => !show)}
          aria-expanded={showItems}
          style={linkButton}
        >
          {I18n.t(
            {one: 'Practiced in 1 item', other: 'Practiced in %{count} items'},
            {count: skill.aligned.length},
          )}
        </button>
      </div>

      {showItems && (
        <div style={{marginTop: 8}}>
          {skill.aligned.length === 0 ? (
            <p style={{color: INK.secondary, margin: 0}}>
              {I18n.t('Nothing is aligned to this skill yet, so no results can show up.')}
            </p>
          ) : (
            <ul style={{margin: 0, paddingLeft: 20}}>
              {skill.aligned.map(item => (
                <li key={item.id}>{item.url ? <a href={item.url}>{item.title}</a> : item.title}</li>
              ))}
            </ul>
          )}
          {skill.lessons.length > 0 && (
            <>
              <p style={{margin: '12px 0 4px', fontWeight: 500}}>
                {I18n.t('Skipped once mastered:')}
              </p>
              <ul style={{margin: 0, paddingLeft: 20}}>
                {skill.lessons.map(lesson => (
                  <li key={lesson.id}>{lesson.title}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {showStudents && (
        <ul style={{listStyle: 'none', margin: '8px 0 0', padding: 0}}>
          {skill.students.map(student => {
            const spec = levelSpec(student.level)
            return (
              <li
                key={student.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '6px 0',
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <a
                  href={`/self_paced/dashboard?course_id=${courseId}&student_id=${student.id}`}
                  style={{flex: 1}}
                >
                  {student.name}
                </a>
                <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
                  <span
                    aria-hidden="true"
                    style={{width: 10, height: 10, background: spec.color}}
                  />
                  {spec.label()}
                </span>
                {student.score !== null && (
                  <span style={{color: INK.secondary, minWidth: '4rem', textAlign: 'right'}}>
                    {I18n.t('%{score} of %{points}', {
                      score: student.score,
                      points: skill.mastery_points ?? '–',
                    })}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const linkButton: React.CSSProperties = {
  border: 'none',
  background: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--ic-link-color, #0374B5)',
  textDecoration: 'underline',
  cursor: 'pointer',
}
