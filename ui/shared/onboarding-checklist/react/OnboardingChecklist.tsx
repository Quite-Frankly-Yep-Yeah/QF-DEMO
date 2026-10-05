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
import {ACCENT, DIVIDER, ELEVATION, INK, PAPER, ROBOTO, SUCCESS, DANGER} from '@canvas/material'
import {fetchTrack, markStep, resetTrack} from '../api'
import type {OnboardingStep, OnboardingTrack} from '../types'

const I18n = createI18nScope('onboarding_checklist')

const card: React.CSSProperties = {
  background: PAPER,
  borderRadius: 2,
  boxShadow: ELEVATION[2],
  padding: 'clamp(14px, 3vw, 20px)',
  fontFamily: ROBOTO,
  color: INK.primary,
}

const flat: React.CSSProperties = {
  minHeight: 44,
  padding: '0 12px',
  border: 'none',
  background: 'transparent',
  color: ACCENT,
  font: 'inherit',
  fontWeight: 500,
  cursor: 'pointer',
}

const tag: React.CSSProperties = {
  display: 'inline-block',
  marginInlineStart: 8,
  padding: '1px 6px',
  borderRadius: 2,
  border: `1px solid ${DIVIDER}`,
  fontSize: '0.75rem',
  color: INK.secondary,
  verticalAlign: 'middle',
}

type Props = {
  track: string
}

export default function OnboardingChecklist({track}: Props) {
  const [data, setData] = useState<OnboardingTrack | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchTrack(track)
      .then(setData)
      .catch(() => setError(I18n.t("The checklist didn't load. Please refresh the page.")))
  }, [track])

  const run = useCallback(async (action: () => Promise<OnboardingTrack>) => {
    setBusy(true)
    setError('')
    try {
      setData(await action())
    } catch {
      setError(I18n.t("That didn't save. Please try again."))
    } finally {
      setBusy(false)
    }
  }, [])

  if (!data) {
    return (
      <div style={card} role={error ? 'alert' : 'status'}>
        {error || I18n.t('Loading the checklist…')}
      </div>
    )
  }

  const startOver = () => {
    if (window.confirm(I18n.t('Clear everything you marked on this checklist?'))) {
      run(() => resetTrack(track))
    }
  }

  const required = data.steps.filter(s => !s.optional)
  const optional = data.steps.filter(s => s.optional)
  const percent = data.total ? Math.round((data.done_count / data.total) * 100) : 0

  return (
    <section style={card} aria-labelledby={`onboarding-${track}-title`}>
      <h2
        id={`onboarding-${track}-title`}
        style={{margin: '0 0 4px', fontWeight: 400, fontSize: '1.25rem'}}
      >
        {data.title}
      </h2>
      <p style={{margin: '0 0 8px', color: INK.secondary}}>
        {I18n.t('%{done} of %{total} done', {done: data.done_count, total: data.total})}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={data.total}
        aria-valuenow={data.done_count}
        aria-label={I18n.t('Checklist progress')}
        style={{height: 4, background: DIVIDER, marginBottom: 16}}
      >
        <div style={{width: `${percent}%`, height: '100%', background: SUCCESS}} />
      </div>
      {error && (
        <p role="alert" style={{color: DANGER}}>
          {error}
        </p>
      )}
      <StepList track={track} steps={required} busy={busy} run={run} />
      {optional.length > 0 && (
        <>
          <h3 style={{margin: '16px 0 4px', fontWeight: 500, fontSize: '1rem'}}>
            {I18n.t('Optional')}
          </h3>
          <StepList track={track} steps={optional} busy={busy} run={run} />
        </>
      )}
      <div style={{marginTop: 12, textAlign: 'end'}}>
        <button type="button" style={flat} onClick={startOver} disabled={busy}>
          {I18n.t('Start over')}
        </button>
      </div>
    </section>
  )
}

type ListProps = {
  track: string
  steps: OnboardingStep[]
  busy: boolean
  run: (action: () => Promise<OnboardingTrack>) => void
}

function StepList({track, steps, busy, run}: ListProps) {
  return (
    <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
      {steps.map(step => (
        <StepRow key={step.key} track={track} step={step} busy={busy} run={run} />
      ))}
    </ul>
  )
}

function StepRow({track, step, busy, run}: {step: OnboardingStep} & Omit<ListProps, 'steps'>) {
  const id = `onboarding-${track}-${step.key}`
  const dismissed = !!step.dismissed_at
  // A step the system sees as done can't be unticked by hand.
  const locked = step.detected === true

  return (
    <li
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: '10px 0',
        borderTop: `1px solid ${DIVIDER}`,
        opacity: dismissed ? 0.6 : 1,
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={step.done}
        disabled={busy || locked}
        onChange={e => run(() => markStep(track, step.key, {done: e.target.checked}))}
        aria-describedby={`${id}-description`}
        style={{width: 20, height: 20, marginTop: 2, flex: 'none'}}
      />
      <div style={{flex: 1, minWidth: 0}}>
        <label
          htmlFor={id}
          style={{fontWeight: 500, textDecoration: dismissed ? 'line-through' : 'none'}}
        >
          {step.title}
        </label>
        {locked && <span style={tag}>{I18n.t('Detected')}</span>}
        <div
          id={`${id}-description`}
          style={{color: INK.secondary, fontSize: '0.875rem', marginTop: 2}}
        >
          {step.description}{' '}
          <a href={step.url} aria-label={I18n.t('Open: %{step}', {step: step.title})}>
            {I18n.t('Open')}
          </a>
        </div>
      </div>
      {!step.done && (
        <button
          type="button"
          style={{...flat, flex: 'none'}}
          disabled={busy}
          aria-label={
            dismissed
              ? I18n.t('Bring back: %{step}', {step: step.title})
              : I18n.t('Set aside: %{step}', {step: step.title})
          }
          onClick={() => run(() => markStep(track, step.key, {dismissed: !dismissed}))}
        >
          {dismissed ? I18n.t('Bring back') : I18n.t('Set aside')}
        </button>
      )}
    </li>
  )
}
