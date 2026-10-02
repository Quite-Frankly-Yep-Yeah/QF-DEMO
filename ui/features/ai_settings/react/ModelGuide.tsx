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
import {INK, ink, PALETTE, tint} from '../../self_paced_home/react/material'
import {card, cardTitle, pill} from './styles'
import type {ModelInfo} from './types'

const I18n = createI18nScope('ai_settings')

// "Claude Haiku 4.5" -> "Haiku"
const family = (label: string) => label.match(/Claude (\w+)/)?.[1] ?? label

const contextText = (tokens: number) =>
  tokens >= 1_000_000
    ? I18n.t('%{amount}M tokens of context', {amount: tokens / 1_000_000})
    : I18n.t('%{amount}K tokens of context', {amount: Math.round(tokens / 1000)})

// The three models side by side: what each is, when to use it, what it costs, and
// which features are using it now. About AI work in general, not any one feature.
export default function ModelGuide({
  models,
  inUse,
  pricesChecked,
}: {
  models: ModelInfo[]
  // feature labels by model id
  inUse: Record<string, string[]>
  pricesChecked: string
}) {
  const cheapest = [...models].sort((a, b) => a.input_price - b.input_price)[0]
  return (
    <section
      aria-label={I18n.t('Models at a glance')}
      style={{gridColumn: '1 / -1', display: 'grid', gap: 'clamp(12px, 2vw, 16px)'}}
    >
      <div
        style={{
          display: 'grid',
          gap: 'clamp(12px, 2vw, 16px)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 17rem), 1fr))',
        }}
      >
        {models.map((model, index) => {
          const color = PALETTE[index % PALETTE.length]
          const headingId = `ai-model-${model.value}`
          return (
            <article
              key={model.value}
              aria-labelledby={headingId}
              style={{...card, borderTop: `4px solid ${color}`}}
            >
              <h3 id={headingId} style={{...cardTitle, color: INK.primary}}>
                {model.label}
              </h3>
              <p style={{margin: '0 0 4px', fontWeight: 500, color: INK.primary}}>
                {model.summary}
              </p>
              <p style={{margin: '0 0 2px', color: INK.secondary, fontSize: '0.8125rem'}}>
                {I18n.t('Use it for')}
              </p>
              <p style={{margin: '0 0 12px', color: INK.primary}}>{model.use_when}</p>
              <p style={{margin: '0 0 4px', fontWeight: 500, color: INK.primary}}>
                {I18n.t('$%{input} in / $%{output} out per 1M tokens', {
                  input: model.input_price,
                  output: model.output_price,
                })}
              </p>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 0 8px'}}>
                <span style={{...pill, background: tint(color, 0.14), color: INK.primary}}>
                  {model.cost_vs_cheapest <= 1
                    ? I18n.t('Lowest price')
                    : I18n.t('%{times}× the cost of %{model}', {
                        times: model.cost_vs_cheapest,
                        model: family(cheapest.label),
                      })}
                </span>
                {(inUse[model.value] ?? []).map(feature => (
                  <span key={feature} style={{...pill, background: ink(color), color: '#fff'}}>
                    {I18n.t('In use: %{feature}', {feature})}
                  </span>
                ))}
              </div>
              <p style={{margin: 0, color: INK.secondary, fontSize: '0.875rem'}}>
                {contextText(model.context_tokens)}
              </p>
              {!model.supports_effort && (
                <p style={{margin: '2px 0 0', color: INK.secondary, fontSize: '0.875rem'}}>
                  {I18n.t('No effort setting')}
                </p>
              )}
            </article>
          )
        })}
      </div>
      <p style={{margin: 0, color: INK.secondary, fontSize: '0.8125rem'}}>
        {I18n.t(
          "List prices per million tokens, checked %{date}. They can change: see Anthropic's pricing page for current rates.",
          {date: pricesChecked},
        )}
      </p>
    </section>
  )
}
