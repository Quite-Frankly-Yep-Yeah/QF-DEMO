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
import doFetchApi from '@canvas/do-fetch-api-effect'
import type {Person} from './types'
import {field, flatButton, Label, muted} from './ui'

const I18n = createI18nScope('supports')

const withSis = (person: Person) =>
  person.sis_user_id ? ` (${I18n.t('SIS ID')} ${person.sis_user_id})` : ''

// Finds a person by name, or for students by SIS ID or login. +url+ answers ?search_term= with {staff: [...]} or
// {students: [...]}; +key+ says which.
export default function PersonPicker({
  label,
  url,
  resultKey,
  selected,
  onSelect,
}: {
  label: string
  url: string
  resultKey: 'staff' | 'students'
  selected: Person | null
  onSelect: (person: Person | null) => void
}) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Person[]>([])

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      doFetchApi<Record<string, Person[]>>({path: url, params: {search_term: term.trim()}})
        .then(({json}) => {
          if (!cancelled) setResults(json?.[resultKey] ?? [])
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [term, url, resultKey])

  if (selected) {
    return (
      <div style={{margin: '4px 0 12px'}}>
        <span style={{fontWeight: 500}}>{label}: </span>
        {selected.name}
        {withSis(selected)}{' '}
        <button type="button" style={flatButton} onClick={() => onSelect(null)}>
          {I18n.t('Change')}
        </button>
      </div>
    )
  }

  return (
    <div>
      <Label text={label}>
        <input
          style={field}
          value={term}
          onChange={event => setTerm(event.target.value)}
          placeholder={I18n.t('Type at least two letters of a name or SIS ID')}
        />
      </Label>
      {results.length > 0 && (
        <ul style={{listStyle: 'none', margin: '-8px 0 12px', padding: 0}}>
          {results.map(person => (
            <li key={person.id}>
              <button
                type="button"
                style={{
                  ...flatButton,
                  textTransform: 'none',
                  letterSpacing: 0,
                  width: '100%',
                  textAlign: 'left',
                }}
                onClick={() => {
                  onSelect(person)
                  setTerm('')
                }}
              >
                {person.name}
                {withSis(person)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {term.trim().length >= 2 && results.length === 0 && (
        <p style={{...muted, margin: '-8px 0 12px'}}>{I18n.t('Nobody found yet.')}</p>
      )}
    </div>
  )
}
