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
import ParametersFields from './ParametersFields'
import type {Catalog, CatalogType, Kind, Parameters} from './types'
import {button, Card, field, flatButton, Label, messageFrom, muted, Status} from './ui'

const I18n = createI18nScope('supports')

type Draft = {name: string; kind: Kind; instructions: string; default_parameters: Parameters}

function TypeForm({
  initial,
  kinds,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: Draft
  kinds: Catalog['kinds']
  busy: boolean
  onSubmit: (draft: Draft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const set = (patch: Partial<Draft>) => setDraft(current => ({...current, ...patch}))
  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        onSubmit(draft)
      }}
      style={{padding: 12, background: '#F5F5F5', borderRadius: 2, margin: '8px 0'}}
    >
      <Label text={I18n.t('Name')}>
        <input
          style={field}
          required
          value={draft.name}
          onChange={event => set({name: event.target.value})}
        />
      </Label>
      <Label text={I18n.t('How the app applies it')}>
        <select
          style={field}
          value={draft.kind}
          onChange={event => set({kind: event.target.value as Kind, default_parameters: {}})}
        >
          {kinds.map(kind => (
            <option key={kind.kind} value={kind.kind}>
              {kind.label}
            </option>
          ))}
        </select>
      </Label>
      <ParametersFields
        kind={draft.kind}
        value={draft.default_parameters}
        onChange={default_parameters => set({default_parameters})}
        idPrefix={`catalog-${initial.name || 'new'}`}
      />
      <Label text={I18n.t('What teachers are told')}>
        <textarea
          style={{...field, minHeight: 72}}
          value={draft.instructions}
          onChange={event => set({instructions: event.target.value})}
        />
      </Label>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
        <button type="submit" style={button} disabled={busy}>
          {I18n.t('Save')}
        </button>
        <button type="button" style={flatButton} onClick={onCancel}>
          {I18n.t('Cancel')}
        </button>
      </div>
    </form>
  )
}

// The school's accommodation catalog. Case managers pick from it; people who
// manage the catalog edit it.
export default function CatalogPanel() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [failed, setFailed] = useState(false)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = () =>
    doFetchApi<Catalog>({path: '/api/v1/supports/catalog'})
      .then(({json}) => json && setCatalog(json))
      .catch(() => setFailed(true))

  useEffect(() => {
    load()
  }, [])

  const save = async (id: number | 'new', draft: Draft) => {
    setBusy(true)
    setMessage('')
    try {
      await doFetchApi({
        path: id === 'new' ? '/api/v1/supports/catalog' : `/api/v1/supports/catalog/${id}`,
        method: id === 'new' ? 'POST' : 'PUT',
        body: draft,
      })
      setEditing(null)
      setMessage(I18n.t('Catalog saved.'))
      await load()
    } catch (error) {
      setMessage(await messageFrom(error))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (type: CatalogType) => {
    setBusy(true)
    try {
      await doFetchApi({path: `/api/v1/supports/catalog/${type.id}`, method: 'DELETE'})
      setMessage(I18n.t('%{name} removed. Plans that already use it keep it.', {name: type.name}))
      await load()
    } catch (error) {
      setMessage(await messageFrom(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      id="supports-catalog"
      title={I18n.t('Accommodation catalog')}
      aside={
        catalog?.can_manage && editing !== 'new' ? (
          <button type="button" style={flatButton} onClick={() => setEditing('new')}>
            {I18n.t('Add to catalog')}
          </button>
        ) : null
      }
    >
      <p style={{...muted, margin: '0 0 12px'}}>
        {I18n.t(
          "The school's list of accommodations. Some are applied by the app once that is turned on; the rest are instructions teachers see.",
        )}
      </p>
      {failed && <p role="alert">{I18n.t("The catalog didn't load.")}</p>}
      {!failed && !catalog && <p>{I18n.t('Loading...')}</p>}
      {catalog && editing === 'new' && (
        <TypeForm
          initial={{name: '', kind: 'informational', instructions: '', default_parameters: {}}}
          kinds={catalog.kinds}
          busy={busy}
          onSubmit={draft => save('new', draft)}
          onCancel={() => setEditing(null)}
        />
      )}
      {catalog && (
        <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
          {catalog.types.map(type => (
            <li key={type.id} style={{padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.12)'}}>
              {editing === type.id ? (
                <TypeForm
                  initial={{
                    name: type.name,
                    kind: type.kind,
                    instructions: type.instructions ?? '',
                    default_parameters: type.default_parameters,
                  }}
                  kinds={catalog.kinds}
                  busy={busy}
                  onSubmit={draft => save(type.id, draft)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{minWidth: 0, flex: '1 1 16rem'}}>
                    <div style={{fontWeight: 500}}>{type.name}</div>
                    <div style={muted}>{type.kind_label}</div>
                    {type.instructions && <div>{type.instructions}</div>}
                  </div>
                  {catalog.can_manage && (
                    <div style={{display: 'flex', gap: 4}}>
                      <button type="button" style={flatButton} onClick={() => setEditing(type.id)}>
                        {I18n.t('Edit')}
                      </button>
                      <button
                        type="button"
                        style={flatButton}
                        disabled={busy}
                        aria-label={I18n.t('Remove %{name}', {name: type.name})}
                        onClick={() => remove(type)}
                      >
                        {I18n.t('Remove')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Status message={message} />
    </Card>
  )
}
