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
import KeySection from './KeySection'
import type {AiSettingsConfig, SaveBody, SettingsResponse} from './types'

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

// The Anthropic key and model for IEP scanning: the school's own, and for
// site admins the shared key and whether schools may use their own
// (docs/superpowers/specs/2026-10-02-anthropic-settings-design.md).
export default function AiSettingsApp({config}: {config: AiSettingsConfig}) {
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

  const save = (path: string, body: SaveBody) =>
    act(() => doFetchApi<SettingsResponse>({path, method: 'PUT', body}), I18n.t('Saved.'))

  const remove = (path: string) =>
    act(() => doFetchApi<SettingsResponse>({path, method: 'DELETE'}), I18n.t('Key removed.'))

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

  const allowSchoolKeys = data?.site?.allow_account_keys ?? data?.policy.allow_account_keys ?? true

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
          margin: '0 0 8px',
          fontWeight: 300,
          fontSize: 'clamp(1.75rem, 1rem + 3vw, 2.5rem)',
          color: INK.primary,
        }}
      >
        {I18n.t('AI settings')}
      </h1>
      <p style={{margin: '0 0 16px', color: INK.secondary}}>
        {I18n.t(
          'The Anthropic key IEP scanning uses. A saved key is never shown again; you can replace or remove it.',
        )}
      </p>

      {loadError && (
        <p role="alert" style={{color: '#B71C1C'}}>
          {loadError}
        </p>
      )}
      {!data && !loadError && <p style={{color: INK.secondary}}>{I18n.t('Loading…')}</p>}

      {data && (
        <div style={{display: 'grid', gap: 'clamp(12px, 3vw, 20px)', maxWidth: '40rem'}}>
          <div>
            <p style={{margin: 0, fontWeight: 500, color: INK.primary}}>
              {inEffectText(data.in_effect.source)}
            </p>
            {data.in_effect.account_key_ignored && (
              <p style={{margin: '4px 0 0', color: INK.secondary}}>
                {I18n.t(
                  "This school has its own key, but the site doesn't allow school keys, so it isn't being used.",
                )}
              </p>
            )}
          </div>

          {!config.is_site_admin_account && (
            <KeySection
              title={I18n.t("This school's key")}
              setting={data.account}
              models={config.models}
              defaultModel={config.default_model}
              busy={busy}
              onSave={body => save(base, body)}
              onRemove={() => remove(base)}
              onTest={body => test('account', body)}
            />
          )}

          {config.can_manage_site && (
            <KeySection
              title={I18n.t('Site-wide key')}
              setting={data.site}
              models={config.models}
              defaultModel={config.default_model}
              busy={busy}
              onSave={body => save(`${base}/site`, body)}
              onRemove={() => remove(`${base}/site`)}
              onTest={body => test('site', body)}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 44,
                  margin: '0 0 8px',
                }}
              >
                <input
                  type="checkbox"
                  checked={allowSchoolKeys}
                  disabled={busy}
                  onChange={event =>
                    save(`${base}/site`, {allow_account_keys: event.target.checked})
                  }
                />
                {I18n.t('Let schools use their own key')}
              </label>
            </KeySection>
          )}
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
