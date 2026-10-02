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
import {DIVIDER, ELEVATION, INK, PAPER, ROBOTO} from '@canvas/material'
import {THEMES, type ThemeId} from '@canvas/material/themes'
import {IconCheckSolid} from '@instructure/ui-icons'

const I18n = createI18nScope('account_sidebar')

type Props = {
  theme: ThemeId
  onChoose: (id: ThemeId) => void
}

const SWATCHES = ['appBar', 'surface', 'paper', 'accent'] as const

// The speech bubble: a paper panel with a tail pointing back at the button
// that opened it.
export default function ThemePopover({theme, onChoose}: Props) {
  return (
    <div
      style={{
        position: 'relative',
        width: 300,
        padding: 8,
        borderRadius: 8,
        background: PAPER,
        boxShadow: ELEVATION[8],
        fontFamily: ROBOTO,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: -6,
          width: 12,
          height: 12,
          marginTop: -6,
          background: PAPER,
          transform: 'rotate(45deg)',
          boxShadow: '-2px 2px 3px rgba(0,0,0,0.12)',
        }}
      />
      <div role="radiogroup" aria-label={I18n.t('Themes')} style={{position: 'relative'}}>
        {(Object.keys(THEMES) as ThemeId[]).map(id => {
          const {name, tokens} = THEMES[id]
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === theme}
              onClick={() => onChoose(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                minHeight: 48,
                padding: '0 12px',
                border: 0,
                borderBottom: `1px solid ${DIVIDER}`,
                background: 'transparent',
                color: INK.primary,
                cursor: 'pointer',
                font: 'inherit',
                textAlign: 'start',
              }}
            >
              <span style={{display: 'flex', gap: 4}} aria-hidden="true">
                {SWATCHES.map(key => (
                  <span
                    key={key}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: tokens[key],
                      border: '1px solid rgba(128,128,128,0.5)',
                    }}
                  />
                ))}
              </span>
              <span style={{flex: 1}}>{name}</span>
              {id === theme && <IconCheckSolid size="x-small" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
