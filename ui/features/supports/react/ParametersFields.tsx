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

import React from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import type {Kind, Parameters} from './types'
import {field, Label} from './ui'

const I18n = createI18nScope('supports')

// The settings an accommodation of +kind+ takes (Supports::AccommodationType
// .parameter_errors checks them on the server). Kinds that are only
// instructions for the teacher take none.
export default function ParametersFields({
  kind,
  value,
  onChange,
  idPrefix,
}: {
  kind: Kind
  value: Parameters
  onChange: (value: Parameters) => void
  idPrefix: string
}) {
  const set = (patch: Parameters) => onChange({...value, ...patch})

  switch (kind) {
    case 'extended_time': {
      const byMinutes =
        value.minutes !== undefined && value.minutes !== '' && value.multiplier === undefined
      return (
        <fieldset style={{border: 'none', margin: 0, padding: 0}}>
          <legend style={{fontWeight: 500, marginBottom: 4}}>{I18n.t('How much more time')}</legend>
          <label style={{display: 'block', minHeight: 32}}>
            <input
              type="radio"
              name={`${idPrefix}-time`}
              checked={!byMinutes}
              onChange={() => onChange({multiplier: 1.5})}
            />{' '}
            {I18n.t('A multiple of the time limit')}
          </label>
          <label style={{display: 'block', minHeight: 32}}>
            <input
              type="radio"
              name={`${idPrefix}-time`}
              checked={byMinutes}
              onChange={() => onChange({minutes: 30})}
            />{' '}
            {I18n.t('A number of extra minutes')}
          </label>
          {byMinutes ? (
            <Label text={I18n.t('Extra minutes')}>
              <input
                style={field}
                type="number"
                min={1}
                max={10080}
                value={value.minutes ?? ''}
                onChange={event => onChange({minutes: event.target.value})}
              />
            </Label>
          ) : (
            <Label text={I18n.t('Time multiplier, for example 1.5')}>
              <input
                style={field}
                type="number"
                min={1.1}
                max={5}
                step={0.25}
                value={value.multiplier ?? ''}
                onChange={event => onChange({multiplier: event.target.value})}
              />
            </Label>
          )}
        </fieldset>
      )
    }
    case 'extended_deadlines':
      return (
        <fieldset style={{border: 'none', margin: 0, padding: 0}}>
          <legend style={{fontWeight: 500, marginBottom: 4}}>{I18n.t('How pacing changes')}</legend>
          <label style={{display: 'block', minHeight: 32}}>
            <input
              type="radio"
              name={`${idPrefix}-mode`}
              checked={value.mode !== 'lower_daily'}
              onChange={() => set({mode: 'extend_finish'})}
            />{' '}
            {I18n.t('Move the finish date out')}
          </label>
          <label style={{display: 'block', minHeight: 32}}>
            <input
              type="radio"
              name={`${idPrefix}-mode`}
              checked={value.mode === 'lower_daily'}
              onChange={() => set({mode: 'lower_daily'})}
            />{' '}
            {I18n.t('Lower the daily target, keep the finish date')}
          </label>
          <Label text={I18n.t('By what percentage')}>
            <input
              style={field}
              type="number"
              min={1}
              max={200}
              value={value.percent ?? ''}
              onChange={event => set({percent: event.target.value})}
            />
          </Label>
        </fieldset>
      )
    case 'extra_attempts':
      return (
        <Label text={I18n.t('Extra attempts')}>
          <input
            style={field}
            type="number"
            min={1}
            max={10}
            value={value.attempts ?? ''}
            onChange={event => set({attempts: event.target.value})}
          />
        </Label>
      )
    case 'check_ins':
      return (
        <Label text={I18n.t('Check in every how many days')}>
          <input
            style={field}
            type="number"
            min={1}
            max={60}
            value={value.every_days ?? ''}
            onChange={event => set({every_days: event.target.value})}
          />
        </Label>
      )
    case 'display':
      return (
        <Label text={I18n.t('Display setting')}>
          <select
            style={field}
            value={value.setting ?? ''}
            onChange={event => set({setting: event.target.value as Parameters['setting']})}
          >
            <option value="">{I18n.t('Choose one')}</option>
            <option value="high_contrast">{I18n.t('High contrast')}</option>
            <option value="use_dyslexic_font">{I18n.t('Dyslexia-friendly font')}</option>
          </select>
        </Label>
      )
    default:
      return null
  }
}
