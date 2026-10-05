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
import {INK} from '@canvas/self-paced/material'
import {card, cardTitle, field, flat, raised} from './styles'
import type {ModelInfo} from './types'

const I18n = createI18nScope('ai_settings')

export type ModelScope = {
  scope: 'account' | 'site'
  // what a blank choice means at this level
  inheritLabel: string
  // the saved choice; blank means none
  saved: string
}

// One compact card for one thing that has a model: a feature, or the default for
// everything else. Each level (school, site) has its own picker and its own Save.
export default function ModelCard({
  title,
  note,
  models,
  scopes,
  inUse,
  recommendation,
  busy,
  onSave,
}: {
  title: string
  note?: string
  models: ModelInfo[]
  scopes: ModelScope[]
  // e.g. "Claude Sonnet 5.5 (the school's choice for this feature)"
  inUse: string | null
  // undefined: this card has no recommendation slot; null: none chosen yet
  recommendation?: {model: string; label: string; why: string | null} | null
  busy: boolean
  onSave: (scope: 'account' | 'site', value: string) => Promise<boolean>
}) {
  const savedKey = JSON.stringify(scopes.map(s => [s.scope, s.saved]))
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(scopes.map(s => [s.scope, s.saved])),
  )
  const previousSaved = useRef<Record<string, string>>(
    Object.fromEntries(scopes.map(s => [s.scope, s.saved])),
  )
  const selects = useRef<Record<string, HTMLSelectElement | null>>({})
  const [focusScope, setFocusScope] = useState<string | null>(null)

  // Each level takes up its own saved choice when that changes, so saving the
  // school's pick doesn't throw away an unsaved pick for the site.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the saved choices
  useEffect(() => {
    setDrafts(current => {
      const merged = {...current}
      for (const s of scopes) {
        if ((previousSaved.current[s.scope] ?? '') !== s.saved) merged[s.scope] = s.saved
      }
      return merged
    })
    previousSaved.current = Object.fromEntries(scopes.map(s => [s.scope, s.saved]))
  }, [savedKey])

  // after saving, focus goes back to the picker instead of being lost
  useEffect(() => {
    if (focusScope && !busy) {
      selects.current[focusScope]?.focus()
      setFocusScope(null)
    }
  }, [focusScope, busy])
  const headingId = `ai-model-card-${title.replace(/\W+/g, '-').toLowerCase()}`

  // a saved model that is no longer offered still shows, so it can be seen and cleared
  const optionsFor = (current: string) =>
    current && !models.some(model => model.value === current)
      ? [
          ...models,
          {value: current, label: I18n.t('%{model} (no longer offered)', {model: current})},
        ]
      : models

  return (
    <section aria-labelledby={headingId} style={card}>
      <h3 id={headingId} style={{...cardTitle, color: INK.primary}}>
        {title}
      </h3>
      {note && (
        <p style={{margin: '0 0 8px', color: INK.secondary, fontSize: '0.875rem'}}>{note}</p>
      )}
      {inUse && (
        <p style={{margin: '0 0 8px', color: INK.primary, fontSize: '0.875rem'}}>
          {I18n.t('In use: %{model}', {model: inUse})}
        </p>
      )}
      {recommendation !== undefined && (
        <div style={{margin: '0 0 8px', fontSize: '0.875rem'}}>
          {recommendation ? (
            <>
              <p style={{margin: 0, fontWeight: 500, color: INK.primary}}>
                {I18n.t('Recommended: %{model}', {model: recommendation.label})}
              </p>
              {recommendation.why && (
                <p style={{margin: 0, color: INK.secondary}}>{recommendation.why}</p>
              )}
            </>
          ) : (
            <p style={{margin: 0, color: INK.secondary}}>{I18n.t('No recommendation yet')}</p>
          )}
        </div>
      )}
      {scopes.map(scope => {
        const level = scope.scope === 'account' ? I18n.t('school') : I18n.t('site')
        const draft = drafts[scope.scope] ?? ''
        const changed = draft !== scope.saved
        return (
          <div
            key={scope.scope}
            style={{display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8}}
          >
            <label
              style={{flex: '1 1 11rem', fontWeight: 500, color: INK.primary, fontSize: '0.875rem'}}
            >
              {scope.scope === 'account' ? I18n.t('School') : I18n.t('Site')}
              <select
                style={field}
                aria-label={`${title}, ${level}`}
                ref={element => {
                  selects.current[scope.scope] = element
                }}
                value={draft}
                disabled={busy}
                onChange={event => setDrafts({...drafts, [scope.scope]: event.target.value})}
              >
                <option value="">{scope.inheritLabel}</option>
                {optionsFor(draft).map(model => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
            {recommendation && recommendation.model !== draft && (
              <button
                type="button"
                style={{...flat, marginBottom: 8}}
                aria-label={I18n.t('Use recommended for %{title}, %{level}', {title, level})}
                disabled={busy}
                onClick={() => setDrafts({...drafts, [scope.scope]: recommendation.model})}
              >
                {I18n.t('Use recommended')}
              </button>
            )}
            <button
              type="button"
              style={{...raised, marginBottom: 8, opacity: busy || !changed ? 0.5 : 1}}
              aria-label={I18n.t('Save %{title}, %{level}', {title, level})}
              disabled={busy || !changed}
              onClick={async () => {
                if (await onSave(scope.scope, draft)) setFocusScope(scope.scope)
              }}
            >
              {I18n.t('Save')}
            </button>
          </div>
        )
      })}
    </section>
  )
}
