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

import React, {useEffect, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {FlatButton, Pill} from './bits'
import {MIN_SEARCH, statusOptions} from './catalogModel'
import {ELEVATION, INK, ROBOTO} from './material'
import type {Filters, Option, Teacher, TriFilter} from './types'

const I18n = createI18nScope('course_catalog')

function Group({legend, children}: {legend: string; children: React.ReactNode}) {
  return (
    <fieldset
      style={{border: 0, margin: 0, padding: '12px 0', borderTop: '1px solid rgba(0,0,0,0.12)'}}
    >
      <legend
        style={{
          padding: 0,
          marginBottom: 4,
          fontSize: '0.75rem',
          fontWeight: 500,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: INK.secondary,
        }}
      >
        {legend}
      </legend>
      {children}
    </fieldset>
  )
}

const CHOICE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minHeight: 36,
  fontSize: '0.9375rem',
  color: INK.primary,
  cursor: 'pointer',
}

function Radios<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: T
  options: {value: T; label: string}[]
  onChange: (value: T) => void
}) {
  return (
    <>
      {options.map(option => (
        <label key={option.value} style={CHOICE}>
          <input
            type="radio"
            name={name}
            className="cc-input"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            style={{accentColor: '#2B7ABC'}}
          />
          {option.label}
        </label>
      ))}
    </>
  )
}

function Checks({
  options,
  selected,
  onChange,
}: {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
}) {
  return (
    <div style={{maxHeight: 200, overflowY: 'auto'}}>
      {options.map(option => (
        <label key={option.id} style={CHOICE}>
          <input
            type="checkbox"
            className="cc-input"
            checked={selected.includes(option.id)}
            onChange={event =>
              onChange(
                event.target.checked
                  ? [...selected, option.id]
                  : selected.filter(id => id !== option.id),
              )
            }
            style={{accentColor: '#2B7ABC'}}
          />
          {option.name}
        </label>
      ))}
    </div>
  )
}

function TeacherFilter({
  teachers,
  onChange,
  search,
}: {
  teachers: Teacher[]
  onChange: (teachers: Teacher[]) => void
  search: (term: string, signal: AbortSignal) => Promise<Teacher[]>
}) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Teacher[]>([])

  useEffect(() => {
    if (term.trim().length < MIN_SEARCH) {
      setResults([])
      return undefined
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      search(term.trim(), controller.signal)
        .then(setResults)
        .catch(() => {})
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [term, search])

  const choices = results.filter(found => !teachers.some(t => t.id === found.id))
  return (
    <>
      <div style={{display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4}}>
        {teachers.map(teacher => (
          <button
            key={teacher.id}
            type="button"
            className="cc-flat"
            aria-label={I18n.t('Remove teacher %{name}', {name: teacher.name})}
            onClick={() => onChange(teachers.filter(t => t.id !== teacher.id))}
            style={{border: 0, background: 'transparent', padding: 0, cursor: 'pointer'}}
          >
            <Pill color="#2a78d6">{teacher.name} ×</Pill>
          </button>
        ))}
      </div>
      <label>
        <span className="screenreader-only">{I18n.t('Search teachers')}</span>
        <input
          type="search"
          className="cc-input"
          value={term}
          placeholder={I18n.t('Search teachers')}
          onChange={event => setTerm(event.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '6px 0',
            fontFamily: ROBOTO,
            fontSize: '0.9375rem',
            background: 'transparent',
            border: 0,
            borderBottom: '1px solid rgba(0,0,0,0.42)',
            borderRadius: 0,
          }}
        />
      </label>
      {choices.length > 0 && (
        <ul
          aria-label={I18n.t('Matching teachers')}
          style={{listStyle: 'none', margin: 0, padding: 0}}
        >
          {choices.map(found => (
            <li key={found.id}>
              <button
                type="button"
                className="cc-row"
                onClick={() => {
                  onChange([...teachers, found])
                  setTerm('')
                }}
                style={{
                  width: '100%',
                  minHeight: 36,
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  textAlign: 'left',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {found.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

type Props = {
  filters: Filters
  terms: Option[]
  subaccounts: Option[]
  activeCount: number
  onChange: (changes: Partial<Filters>) => void
  onClear: () => void
  searchTeachers: (term: string, signal: AbortSignal) => Promise<Teacher[]>
}

// Every way to narrow the catalog, in one column.
export default function FilterPanel({
  filters,
  terms,
  subaccounts,
  activeCount,
  onChange,
  onClear,
  searchTeachers,
}: Props) {
  const tri = (): {value: TriFilter; label: string}[] => [
    {value: 'any', label: I18n.t('Any')},
    {value: 'yes', label: I18n.t('Yes')},
    {value: 'no', label: I18n.t('No')},
  ]

  return (
    <div
      style={{
        background: '#F5F5F5',
        borderRadius: 2,
        boxShadow: ELEVATION[2],
        padding: '8px 20px 16px',
        fontFamily: ROBOTO,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <h2 style={{margin: 0, fontFamily: ROBOTO, fontSize: '1.125rem', fontWeight: 500}}>
          {I18n.t('Filters')}
        </h2>
        <FlatButton disabled={activeCount === 0} onClick={onClear}>
          {I18n.t('Clear all')}
        </FlatButton>
      </div>

      <Group legend={I18n.t('Status')}>
        <Radios
          name="cc-status"
          value={filters.status}
          options={statusOptions()}
          onChange={status => onChange({status})}
        />
      </Group>
      {terms.length > 0 && (
        <Group legend={I18n.t('Term')}>
          <Checks options={terms} selected={filters.terms} onChange={t => onChange({terms: t})} />
        </Group>
      )}
      {subaccounts.length > 0 && (
        <Group legend={I18n.t('Sub-account')}>
          <Checks
            options={subaccounts}
            selected={filters.subaccounts}
            onChange={s => onChange({subaccounts: s})}
          />
        </Group>
      )}
      <Group legend={I18n.t('Teacher')}>
        <TeacherFilter
          teachers={filters.teachers}
          onChange={teachers => onChange({teachers})}
          search={searchTeachers}
        />
      </Group>
      <Group legend={I18n.t('Has students')}>
        <Radios
          name="cc-enrollments"
          value={filters.enrollments}
          options={tri()}
          onChange={enrollments => onChange({enrollments})}
        />
      </Group>
      <Group legend={I18n.t('Blueprint')}>
        <Radios
          name="cc-blueprint"
          value={filters.blueprint}
          options={tri()}
          onChange={blueprint => onChange({blueprint})}
        />
      </Group>
    </div>
  )
}
