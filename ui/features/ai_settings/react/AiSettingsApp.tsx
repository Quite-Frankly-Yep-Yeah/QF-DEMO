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
import {INK, ROBOTO, SURFACE} from '../../self_paced_home/react/material'
import KeyCard from './KeyCard'
import ModelCard, {type ModelScope} from './ModelCard'
import ModelGuide from './ModelGuide'
import {card, cardTitle} from './styles'
import type {AiSettingsConfig, ModelSource, SaveBody, SettingsResponse} from './types'
import {useMaterialPage} from '@canvas/material/useMaterialPage'
import {DANGER} from '@canvas/material'

const I18n = createI18nScope('ai_settings')

// What the server said when it refused, or a general message.
async function messageFrom(error: unknown): Promise<string> {
  const response = (error as {response?: Response} | null)?.response
  try {
    const json = await response?.json()
    if (Array.isArray(json?.errors) && json.errors.length > 0) return json.errors.join(' ')
    if (typeof json?.message === 'string') return json.message
  } catch {
    // fall through
  }
  return I18n.t("That didn't work. Please try again.")
}

function inEffectText(source: SettingsResponse['in_effect']['source']): string {
  switch (source) {
    case 'account':
      return I18n.t("This school's key is in use.")
    case 'site':
      return I18n.t("The site's shared key is in use.")
    case 'file':
      return I18n.t("The server's configuration is in use.")
    default:
      return I18n.t('No key is set up, so IEP scanning is off.')
  }
}

function modelSourceText(source: ModelSource | null): string {
  switch (source) {
    case 'account_feature':
      return I18n.t("the school's choice for this feature")
    case 'account_default':
      return I18n.t("the school's default")
    case 'site_feature':
      return I18n.t("the site's choice for this feature")
    case 'site_default':
      return I18n.t("the site's default")
    case 'file':
      return I18n.t("the server's configuration")
    default:
      return I18n.t("the app's default")
  }
}

// The Anthropic key and the model each AI feature uses: the school's own, and for
// site admins the shared ones and the policies. Laid out as a dashboard of cards
// (docs/superpowers/specs/2026-10-02-anthropic-settings-design.md).
export default function AiSettingsApp({config}: {config: AiSettingsConfig}) {
  useMaterialPage()
  const base = `/api/v1/accounts/${config.account_id}/ai_settings`
  const [data, setData] = useState<SettingsResponse | null>(null)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    doFetchApi<SettingsResponse>({path: base})
      .then(({json}) => json && setData(json))
      .catch(async error => setLoadError(await messageFrom(error)))
  }, [base])

  const act = useCallback(
    async (request: () => Promise<{json?: SettingsResponse}>, done: string): Promise<boolean> => {
      setBusy(true)
      setMessage('')
      try {
        const {json} = await request()
        if (json) setData(json)
        setMessage(done)
        return true
      } catch (error) {
        setMessage(await messageFrom(error))
        return false
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const pathFor = (scope: 'account' | 'site') => (scope === 'site' ? `${base}/site` : base)

  const save = (scope: 'account' | 'site', body: SaveBody) =>
    act(
      () => doFetchApi<SettingsResponse>({path: pathFor(scope), method: 'PUT', body}),
      I18n.t('Saved.'),
    )

  const remove = (scope: 'account' | 'site') =>
    act(
      () => doFetchApi<SettingsResponse>({path: pathFor(scope), method: 'DELETE'}),
      I18n.t('Key removed.'),
    )

  const test = async (scope: 'account' | 'site', body: SaveBody) => {
    setBusy(true)
    setMessage('')
    try {
      const {json} = await doFetchApi<{ok: boolean; message: string}>({
        path: `${base}/test`,
        method: 'POST',
        body: {scope, ...body},
      })
      setMessage(json?.message ?? '')
    } catch (error) {
      setMessage(await messageFrom(error))
    } finally {
      setBusy(false)
    }
  }

  const modelName = (value: string | null) =>
    config.models.find(model => model.value === value)?.label ?? value ?? ''

  const inEffect = data?.in_effect
  const allowSchoolKeys = data?.site?.allow_account_keys ?? data?.policy.allow_account_keys ?? true
  const allowSchoolModels =
    data?.site?.allow_account_models ?? data?.policy.allow_account_models ?? true

  // the feature labels using each model, for the guide cards
  const inUse: Record<string, string[]> = {}
  for (const feature of inEffect?.features ?? []) {
    if (feature.model) (inUse[feature.model] ??= []).push(feature.label)
  }

  const scopesFor = (
    saved: (setting: NonNullable<SettingsResponse['account']>) => string,
    inherit: {account: string; site: string},
  ): ModelScope[] => {
    const scopes: ModelScope[] = []
    if (config.can_manage_school) {
      scopes.push({
        scope: 'account',
        inheritLabel: inherit.account,
        saved: data?.account ? saved(data.account) : '',
      })
    }
    if (config.can_manage_site) {
      scopes.push({
        scope: 'site',
        inheritLabel: inherit.site,
        saved: data?.site ? saved(data.site) : '',
      })
    }
    return scopes
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: 'clamp(12px, 2vw, 16px)',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 19rem), 1fr))',
    alignItems: 'start',
  }

  return (
    <div
      style={{
        fontFamily: ROBOTO,
        background: SURFACE,
        minHeight: '100%',
        padding: 'clamp(12px, 3vw, 24px)',
      }}
    >
      <h1
        style={{
          margin: '0 0 4px',
          fontWeight: 300,
          fontSize: 'clamp(1.75rem, 1rem + 3vw, 2.5rem)',
          color: INK.primary,
        }}
      >
        {I18n.t('AI settings')}
      </h1>
      <p style={{margin: '0 0 16px', color: INK.secondary}}>
        {I18n.t(
          'The Anthropic key and the model each AI feature uses. A saved key is never shown again; you can replace or remove it.',
        )}
      </p>

      {loadError && (
        <p role="alert" style={{color: DANGER}}>
          {loadError}
        </p>
      )}
      {!data && !loadError && <p style={{color: INK.secondary}}>{I18n.t('Loading…')}</p>}

      {data && inEffect && (
        <div data-testid="ai-settings-grid" style={gridStyle}>
          <ModelGuide models={config.models} inUse={inUse} pricesChecked={config.prices_checked} />

          <section aria-labelledby="ai-in-effect" style={card}>
            <h2 id="ai-in-effect" style={{...cardTitle, color: INK.primary}}>
              {I18n.t('In effect')}
            </h2>
            <p style={{margin: 0, fontWeight: 500, color: INK.primary}}>
              {inEffectText(inEffect.source)}
            </p>
            {inEffect.account_key_ignored && (
              <p style={{margin: '8px 0 0', color: INK.secondary}}>
                {I18n.t(
                  "This school has its own key, but the site doesn't allow school keys, so it isn't being used.",
                )}
              </p>
            )}
            {inEffect.school_models_ignored && (
              <p style={{margin: '8px 0 0', color: INK.secondary}}>
                {I18n.t(
                  "This school has chosen models, but the site doesn't let schools choose models on the shared key, so they aren't being used.",
                )}
              </p>
            )}
          </section>

          {config.can_manage_site && (
            <section aria-labelledby="ai-policies" style={card}>
              <h2 id="ai-policies" style={{...cardTitle, color: INK.primary}}>
                {I18n.t('Site policies')}
              </h2>
              <label style={{display: 'flex', alignItems: 'center', gap: 8, minHeight: 44}}>
                <input
                  type="checkbox"
                  checked={allowSchoolKeys}
                  disabled={busy}
                  onChange={event => save('site', {allow_account_keys: event.target.checked})}
                />
                {I18n.t('Let schools use their own key')}
              </label>
              <label style={{display: 'flex', alignItems: 'center', gap: 8, minHeight: 44}}>
                <input
                  type="checkbox"
                  checked={allowSchoolModels}
                  disabled={busy}
                  onChange={event => save('site', {allow_account_models: event.target.checked})}
                />
                {I18n.t('Let schools choose models when they use the shared key')}
              </label>
            </section>
          )}

          {config.can_manage_school && (
            <KeyCard
              title={I18n.t("This school's key")}
              setting={data.account}
              busy={busy}
              onSave={body => save('account', body)}
              onRemove={() => remove('account')}
              onTest={body => test('account', body)}
            />
          )}
          {config.can_manage_site && (
            <KeyCard
              title={I18n.t('Site-wide key')}
              setting={data.site}
              busy={busy}
              onSave={body => save('site', body)}
              onRemove={() => remove('site')}
              onTest={body => test('site', body)}
            />
          )}

          <ModelCard
            title={I18n.t('Default model')}
            note={I18n.t('Used by any feature that has no model of its own.')}
            models={config.models}
            scopes={scopesFor(setting => setting.model ?? '', {
              account: I18n.t("Use the site's default"),
              site: I18n.t('Use the app default'),
            })}
            inUse={
              inEffect.model
                ? `${modelName(inEffect.model)} (${modelSourceText(inEffect.model_source)})`
                : null
            }
            busy={busy}
            onSave={(scope, value) => save(scope, {model: value})}
          />

          {config.features.map(feature => {
            const used = inEffect.features.find(entry => entry.feature === feature.key)
            return (
              <ModelCard
                key={feature.key}
                title={feature.label}
                models={config.models}
                scopes={scopesFor(setting => setting.feature_models?.[feature.key] ?? '', {
                  account: I18n.t('Use the default model'),
                  site: I18n.t('Use the default model'),
                })}
                inUse={
                  used?.model
                    ? `${modelName(used.model)} (${modelSourceText(used.model_source)})`
                    : null
                }
                recommendation={
                  feature.recommended
                    ? {
                        model: feature.recommended,
                        label: modelName(feature.recommended),
                        why: feature.why,
                      }
                    : null
                }
                busy={busy}
                onSave={(scope, value) => save(scope, {models: {[feature.key]: value}})}
              />
            )
          })}
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        style={{marginTop: message ? 12 : 0, color: INK.secondary}}
      >
        {message}
      </div>
    </div>
  )
}
