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
import {APP_BAR, ELEVATION, ink, INK, ROBOTO} from '../../self_paced_home/react/material'
import type {SaveBody, SettingJson} from './types'

const I18n = createI18nScope('ai_settings')

export const card: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 2,
  boxShadow: ELEVATION[4],
  padding: 'clamp(16px, 4vw, 24px)',
  fontFamily: ROBOTO,
  minWidth: 0,
}

const field: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 44,
  padding: '10px 12px',
  margin: '4px 0 12px',
  border: '1px solid #9E9E9E',
  borderRadius: 2,
  font: 'inherit',
  fontSize: '1rem',
  background: '#fff',
}

const raised: React.CSSProperties = {
  minHeight: 44,
  padding: '0 20px',
  border: 'none',
  borderRadius: 2,
  background: ink(APP_BAR),
  color: '#fff',
  font: 'inherit',
  fontWeight: 500,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: ELEVATION[2],
}

const flat: React.CSSProperties = {
  ...raised,
  background: 'transparent',
  color: ink(APP_BAR),
  boxShadow: 'none',
  padding: '0 12px',
}

// One key and model: the school's or the site's. A saved key is never shown,
// only its last four characters; what is typed is sent once and then cleared.
export default function KeySection({
  title,
  setting,
  models,
  features,
  inheritLabel,
  busy,
  onSave,
  onRemove,
  onTest,
  children,
}: {
  title: string
  setting: SettingJson | null
  models: {value: string; label: string}[]
  features: {key: string; label: string}[]
  // what a blank default model means here: the site's default, or the app's
  inheritLabel: string
  busy: boolean
  onSave: (body: SaveBody) => Promise<boolean>
  onRemove: () => Promise<boolean>
  onTest: (body: SaveBody) => void
  children?: React.ReactNode
}) {
  // blank means no choice: the next level decides
  const savedModel = setting?.model ?? ''
  const savedFeatureModels = setting?.feature_models ?? {}
  const savedFeaturesKey = JSON.stringify(savedFeatureModels)
  const hasKey = !!setting?.has_key
  const [keyText, setKeyText] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [model, setModel] = useState(savedModel)
  const [featureModels, setFeatureModels] = useState<Record<string, string>>(savedFeatureModels)
  const [focusReplace, setFocusReplace] = useState(false)
  const replaceRef = useRef<HTMLButtonElement>(null)
  const typed = keyText.trim()
  const modelChanged = model !== savedModel
  const changedFeatures = features.filter(
    feature => (featureModels[feature.key] ?? '') !== (savedFeatureModels[feature.key] ?? ''),
  )
  // a saved model that is no longer offered still shows, so it can be seen and cleared
  const withStale = (current: string) =>
    current && !models.some(option => option.value === current)
      ? [
          ...models,
          {value: current, label: I18n.t('%{model} (no longer offered)', {model: current})},
        ]
      : models
  const nothingToSave = !typed && !modelChanged && changedFeatures.length === 0
  const showField = !hasKey || replacing
  const headingId = `ai-${title.replace(/\W+/g, '-').toLowerCase()}`

  useEffect(() => setModel(savedModel), [savedModel])
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the saved choices
  useEffect(() => setFeatureModels(savedFeatureModels), [savedFeaturesKey])

  useEffect(() => {
    if (focusReplace && replaceRef.current) {
      replaceRef.current.focus()
      setFocusReplace(false)
    }
  }, [focusReplace, hasKey, replacing])

  const save = async () => {
    const body: SaveBody = {}
    if (typed) body.api_key = typed
    if (modelChanged) body.model = model
    if (changedFeatures.length > 0) {
      body.models = Object.fromEntries(
        changedFeatures.map(feature => [feature.key, featureModels[feature.key] ?? '']),
      )
    }
    if (await onSave(body)) {
      setKeyText('')
      setReplacing(false)
      setFocusReplace(true)
    }
  }

  const remove = async () => {
    if (!window.confirm(I18n.t('Remove this key? IEP scanning will stop using it.'))) return
    if (await onRemove()) setKeyText('')
  }

  return (
    <section aria-labelledby={headingId} style={card}>
      <h2
        id={headingId}
        style={{margin: '0 0 12px', fontWeight: 300, fontSize: '1.5rem', color: INK.primary}}
      >
        {title}
      </h2>
      {children}
      {hasKey && !replacing && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            margin: '0 0 12px',
          }}
        >
          <span style={{fontWeight: 500, color: INK.primary}}>
            {I18n.t('Key ending %{last4}', {last4: setting?.key_last4 ?? ''})}
          </span>
          <button
            type="button"
            ref={replaceRef}
            style={flat}
            disabled={busy}
            onClick={() => setReplacing(true)}
          >
            {I18n.t('Replace')}
          </button>
          <button type="button" style={flat} disabled={busy} onClick={remove}>
            {I18n.t('Remove')}
          </button>
        </div>
      )}
      {showField && (
        <label style={{display: 'block', fontWeight: 500, color: INK.primary}}>
          {I18n.t('API key')}
          <input
            style={field}
            type="password"
            autoComplete="off"
            value={keyText}
            onChange={event => setKeyText(event.target.value)}
          />
        </label>
      )}
      <label style={{display: 'block', fontWeight: 500, color: INK.primary}}>
        {I18n.t('Default model')}
        <select style={field} value={model} onChange={event => setModel(event.target.value)}>
          <option value="">{inheritLabel}</option>
          {withStale(model).map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {features.length > 0 && (
        <fieldset style={{border: 'none', margin: '0 0 8px', padding: 0}}>
          <legend style={{fontWeight: 500, color: INK.primary, padding: 0}}>
            {I18n.t('Model for each AI feature')}
          </legend>
          {features.map(feature => (
            <label
              key={feature.key}
              style={{display: 'block', fontWeight: 400, color: INK.primary}}
            >
              {I18n.t('%{feature} model', {feature: feature.label})}
              <select
                style={field}
                value={featureModels[feature.key] ?? ''}
                onChange={event =>
                  setFeatureModels({...featureModels, [feature.key]: event.target.value})
                }
              >
                <option value="">{I18n.t('Use the default model')}</option>
                {withStale(featureModels[feature.key] ?? '').map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      )}
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
        <button
          type="button"
          style={{...raised, opacity: busy || nothingToSave ? 0.5 : 1}}
          disabled={busy || nothingToSave}
          onClick={save}
        >
          {I18n.t('Save')}
        </button>
        <button
          type="button"
          style={flat}
          disabled={busy || (!hasKey && !typed)}
          onClick={() => onTest({...(typed ? {api_key: typed} : {}), ...(model ? {model} : {})})}
        >
          {I18n.t('Test connection')}
        </button>
      </div>
      {setting?.updated_by && setting.updated_at && (
        <p style={{margin: '12px 0 0', color: INK.secondary, fontSize: '0.875rem'}}>
          {I18n.t('Last changed by %{name} on %{date}', {
            name: setting.updated_by.name,
            date: new Date(setting.updated_at).toLocaleDateString(),
          })}
        </p>
      )}
    </section>
  )
}
