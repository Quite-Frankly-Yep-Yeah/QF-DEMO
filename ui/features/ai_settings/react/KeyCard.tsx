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
import {INK} from '../../self_paced_home/react/material'
import {card, cardTitle, field, flat, raised} from './styles'
import type {SaveBody, SettingJson} from './types'

const I18n = createI18nScope('ai_settings')

// One key: the school's or the site's. A saved key is never shown, only its last
// four characters; what is typed is sent once and then cleared.
export default function KeyCard({
  title,
  setting,
  busy,
  onSave,
  onRemove,
  onTest,
}: {
  title: string
  setting: SettingJson | null
  busy: boolean
  onSave: (body: SaveBody) => Promise<boolean>
  onRemove: () => Promise<boolean>
  onTest: (body: SaveBody) => void
}) {
  const hasKey = !!setting?.has_key
  const [keyText, setKeyText] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [focusReplace, setFocusReplace] = useState(false)
  const replaceRef = useRef<HTMLButtonElement>(null)
  const typed = keyText.trim()
  const showField = !hasKey || replacing
  const headingId = `ai-key-${title.replace(/\W+/g, '-').toLowerCase()}`

  useEffect(() => {
    if (focusReplace && replaceRef.current) {
      replaceRef.current.focus()
      setFocusReplace(false)
    }
  }, [focusReplace, hasKey, replacing])

  const save = async () => {
    if (await onSave({api_key: typed})) {
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
      <h2 id={headingId} style={{...cardTitle, color: INK.primary}}>
        {title}
      </h2>
      {hasKey && !replacing && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            margin: '0 0 8px',
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
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
        <button
          type="button"
          style={{...raised, opacity: busy || !typed ? 0.5 : 1}}
          disabled={busy || !typed}
          onClick={save}
        >
          {I18n.t('Save key')}
        </button>
        <button
          type="button"
          style={flat}
          disabled={busy || (!hasKey && !typed)}
          onClick={() => onTest(typed ? {api_key: typed} : {})}
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
