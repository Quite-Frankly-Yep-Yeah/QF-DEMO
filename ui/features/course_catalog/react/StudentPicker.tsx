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

import React, {useEffect, useRef, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {MIN_SEARCH} from './catalogModel'
import {ELEVATION, INK, ROBOTO} from './material'
import type {Student} from './types'

const I18n = createI18nScope('course_catalog')

type Props = {
  student: Student | null
  onChange: (student: Student | null) => void
  search: (term: string, signal: AbortSignal) => Promise<Student[]>
}

// Chooses the student the admin is picking courses for. Shown on the app
// bar: a search field with the matches listed under it, and the choice as a
// chip that clears it.
export default function StudentPicker({student, onChange, search}: Props) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Student[]>([])
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (term.trim().length < MIN_SEARCH) {
      setResults([])
      return undefined
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      search(term.trim(), controller.signal)
        .then(found => {
          setResults(found)
          setFailed(false)
        })
        .catch(error => {
          if ((error as Error).name !== 'AbortError') setFailed(true)
        })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [term, search])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (student) {
    return (
      <div style={{display: 'flex', alignItems: 'center', gap: 8, fontFamily: ROBOTO}}>
        <span style={{opacity: 0.88, fontSize: '0.875rem'}}>{I18n.t('Picking courses for')}</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 4px 4px 12px',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.22)',
            color: '#fff',
            fontWeight: 500,
          }}
        >
          {student.name}
          <button
            type="button"
            className="cc-flat"
            aria-label={I18n.t('Stop picking for %{student}', {student: student.name})}
            onClick={() => onChange(null)}
            style={{
              width: 24,
              height: 24,
              border: 0,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.3)',
              color: '#fff',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      </div>
    )
  }

  const showList = open && term.trim().length >= MIN_SEARCH
  return (
    <div ref={box} style={{position: 'relative', maxWidth: 420, fontFamily: ROBOTO}}>
      <label style={{display: 'block'}}>
        <span style={{display: 'block', fontSize: '0.75rem', opacity: 0.88, marginBottom: 4}}>
          {I18n.t('Pick courses for a student')}
        </span>
        <input
          type="search"
          className="cc-input"
          value={term}
          placeholder={I18n.t('Search students by name')}
          onChange={event => {
            setTerm(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 0',
            fontFamily: ROBOTO,
            fontSize: '1rem',
            color: '#fff',
            background: 'transparent',
            border: 0,
            borderBottom: '1px solid rgba(255,255,255,0.7)',
            borderRadius: 0,
          }}
        />
      </label>
      {showList && (
        <ul
          aria-label={I18n.t('Matching students')}
          style={{
            position: 'absolute',
            zIndex: 10,
            left: 0,
            right: 0,
            margin: '4px 0 0',
            padding: '8px 0',
            listStyle: 'none',
            background: '#F5F5F5',
            color: INK.primary,
            borderRadius: 2,
            boxShadow: ELEVATION[8],
          }}
        >
          {results.map(found => (
            <li key={found.id}>
              <button
                type="button"
                className="cc-row"
                onClick={() => {
                  onChange(found)
                  setTerm('')
                  setOpen(false)
                }}
                style={{
                  width: '100%',
                  minHeight: 44,
                  padding: '0 16px',
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
          {results.length === 0 && (
            <li style={{padding: '12px 16px', color: INK.secondary}}>
              {failed ? I18n.t("Students didn't load.") : I18n.t('No students match.')}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
