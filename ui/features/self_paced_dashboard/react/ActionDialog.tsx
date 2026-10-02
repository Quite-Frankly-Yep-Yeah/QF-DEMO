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
import {Modal} from '@instructure/ui-modal'
import {Heading} from '@instructure/ui-heading'
import {Button, CloseButton} from '@instructure/ui-buttons'
import {TextArea} from '@instructure/ui-text-area'
import {TextInput} from '@instructure/ui-text-input'
import {NumberInput} from '@instructure/ui-number-input'
import {Text} from '@instructure/ui-text'
import {INK} from './colors'
import {PAPER} from './material'

const I18n = createI18nScope('self_paced_dashboard')

export type DialogValues = {
  reason: string
  attempts: number
  subject: string
  body: string
  itemId: string
  action: string
}

export type ItemChoice = {id: string; label: string; group: string}
export type ActionChoice = {value: string; label: string; askAttempts?: boolean}

const EMPTY: DialogValues = {reason: '', attempts: 1, subject: '', body: '', itemId: '', action: ''}

export type DialogSpec = {
  title: string
  explanation?: string
  confirmLabel: string
  askAttempts?: boolean
  // a message or note: the text is required
  askBody?: {label: string}
  askSubject?: boolean
  // everything else asks for an optional reason for the log
  askReason?: boolean
  // reasons that fill the field in one click (an accommodation, say)
  reasonPresets?: string[]
  // a bulk action on one item: which item, and what to do to it
  askItem?: {items: ItemChoice[]; actions: ActionChoice[]}
}

type Props = {
  spec: DialogSpec | null
  onSubmit: (values: DialogValues) => Promise<void>
  onClose: () => void
}

const MAX_ATTEMPTS = 10

// The confirmation for every intervention. It stays open and shows the
// server's reason when the action is turned down.
export default function ActionDialog({spec, onSubmit, onClose}: Props) {
  const [values, setValues] = useState<DialogValues>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!spec) return
    setValues({...EMPTY, action: spec.askItem?.actions[0]?.value ?? ''})
    setError(null)
    setSaving(false)
  }, [spec])

  if (!spec) return null

  const set = (patch: Partial<DialogValues>) => setValues(current => ({...current, ...patch}))
  const missingItem = !!spec.askItem && (values.itemId === '' || values.action === '')
  const incomplete = (!!spec.askBody && values.body.trim() === '') || missingItem
  const chosenAction = spec.askItem?.actions.find(a => a.value === values.action)
  const askAttempts = spec.askAttempts || !!chosenAction?.askAttempts

  const submit = async () => {
    if (incomplete) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit(values)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : I18n.t("That didn't work. Try again."))
      setSaving(false)
    }
  }

  return (
    <Modal
      open={true}
      onDismiss={onClose}
      size="small"
      label={spec.title}
      shouldCloseOnDocumentClick={false}
    >
      <Modal.Header>
        <CloseButton
          placement="end"
          offset="small"
          screenReaderLabel={I18n.t('Cancel')}
          onClick={onClose}
        />
        <Heading level="h2">{spec.title}</Heading>
      </Modal.Header>
      <Modal.Body>
        <form
          id="self-paced-action-form"
          onSubmit={event => {
            event.preventDefault()
            submit()
          }}
          style={{display: 'flex', flexDirection: 'column', gap: 16}}
        >
          {spec.explanation && <p style={{margin: 0, color: INK.secondary}}>{spec.explanation}</p>}
          {spec.askItem && (
            <>
              <label style={FIELD}>
                {I18n.t('Item')}
                <select
                  value={values.itemId}
                  onChange={event => set({itemId: event.target.value})}
                  style={SELECT}
                >
                  <option value="">{I18n.t('Choose an item')}</option>
                  {groups(spec.askItem.items).map(([group, items]) => (
                    <optgroup key={group} label={group}>
                      {items.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label style={FIELD}>
                {I18n.t('Action')}
                <select
                  value={values.action}
                  onChange={event => set({action: event.target.value})}
                  style={SELECT}
                >
                  {spec.askItem.actions.map(action => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {askAttempts && (
            <NumberInput
              renderLabel={I18n.t('Extra tries')}
              value={values.attempts}
              onChange={(_event, value) =>
                set({attempts: Math.max(1, Math.min(MAX_ATTEMPTS, Number(value) || 1))})
              }
              onIncrement={() => set({attempts: Math.min(MAX_ATTEMPTS, values.attempts + 1)})}
              onDecrement={() => set({attempts: Math.max(1, values.attempts - 1)})}
              showArrows={true}
              width="8rem"
            />
          )}
          {spec.askSubject && (
            <TextInput
              renderLabel={I18n.t('Subject')}
              value={values.subject}
              onChange={(_event, value) => set({subject: value})}
            />
          )}
          {spec.askBody && (
            <TextArea
              label={spec.askBody.label}
              value={values.body}
              onChange={event => set({body: event.target.value})}
              height="8rem"
              required={true}
            />
          )}
          {spec.askReason && spec.reasonPresets && spec.reasonPresets.length > 0 && (
            <div
              role="group"
              aria-label={I18n.t('Suggested reasons')}
              style={{display: 'flex', flexWrap: 'wrap', gap: 8}}
            >
              {spec.reasonPresets.map(preset => (
                <Button key={preset} size="small" onClick={() => set({reason: preset})}>
                  {preset}
                </Button>
              ))}
            </div>
          )}
          {spec.askReason && (
            <TextArea
              label={I18n.t('Reason (optional, kept in the history)')}
              value={values.reason}
              onChange={event => set({reason: event.target.value})}
              height="4rem"
            />
          )}
          {error && (
            <div role="alert">
              <Text color="danger">{error}</Text>
            </div>
          )}
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose} margin="0 small 0 0">
          {I18n.t('Cancel')}
        </Button>
        <Button
          color="primary"
          onClick={() => submit()}
          interaction={saving || incomplete ? 'disabled' : 'enabled'}
        >
          {spec.confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

const FIELD: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontWeight: 700,
}
const SELECT: React.CSSProperties = {
  padding: '8px',
  border: `1px solid ${INK.muted}`,
  borderRadius: 2,
  font: 'inherit',
  fontWeight: 400,
  background: PAPER,
}

// Items grouped by unit, in course order.
function groups(items: ItemChoice[]): [string, ItemChoice[]][] {
  const result: [string, ItemChoice[]][] = []
  items.forEach(item => {
    const last = result[result.length - 1]
    if (last && last[0] === item.group) last[1].push(item)
    else result.push([item.group, [item]])
  })
  return result
}
