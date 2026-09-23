/*
 * Copyright (C) 2026 - present EXAMPLE contributors
 *
 * This file is part of EXAMPLE LMS, a modified version of Canvas.
 *
 * EXAMPLE LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
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
import {Button} from '@instructure/ui-buttons'
import {Heading} from '@instructure/ui-heading'
import {IconLockSolid} from '@instructure/ui-icons'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {Spinner} from '@instructure/ui-spinner'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import {
  DEFAULT_COURSE_COLOR,
  roleLabel,
  tint,
  type PlayerItem,
  type PlayerMap,
  type PlayerUnit,
} from '@canvas/self-paced/player'

const I18n = createI18nScope('self_paced_player')

const INK = {primary: '#0b0b0b', secondary: '#52514e', muted: '#6b6a65', line: '#dcdbd4'}

// One animated moment: the current step's marker breathes once a few seconds
// so the eye finds it. Off for people who prefer reduced motion.
const STYLES = `
  @keyframes self-paced-current { 0%, 100% { box-shadow: 0 0 0 0 var(--sp-ring); } 50% { box-shadow: 0 0 0 6px transparent; } }
  .self-paced-current-marker { animation: self-paced-current 2.4s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .self-paced-current-marker { animation: none; } }
  .self-paced-unit > summary { list-style: none; cursor: pointer; }
  .self-paced-unit > summary::-webkit-details-marker { display: none; }
  .self-paced-unit > summary:focus-visible { outline: 2px solid #2a78d6; outline-offset: 2px; }
`

type Config = {map_url: string; course_color?: string | null}

export default function PlayerApp({config}: {config: Config}) {
  const [map, setMap] = useState<PlayerMap | null>(null)
  const [failed, setFailed] = useState(false)
  const color = config.course_color || DEFAULT_COURSE_COLOR

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const {json} = await doFetchApi<PlayerMap>({path: config.map_url})
        if (cancelled) return
        if (json) setMap(json)
        else setFailed(true)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [config.map_url])

  if (failed) {
    return (
      <View as="div" padding="large 0">
        <Text color="danger">
          {I18n.t("Your course map didn't load. Reload the page to try again.")}
        </Text>
      </View>
    )
  }
  if (!map) {
    return (
      <View as="div" textAlign="center" padding="xx-large">
        <Spinner renderTitle={I18n.t('Loading your course')} />
      </View>
    )
  }

  const done = map.requirements_total > 0 && map.requirements_completed >= map.requirements_total

  return (
    <View as="div" padding="small 0 xx-large" maxWidth="56rem">
      <style>{STYLES}</style>
      <Heading level="h1" margin="0 0 small">
        {map.course.name}
      </Heading>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          margin: '8px 0 24px',
        }}
      >
        <div style={{flex: '1 1 18rem', minWidth: '14rem'}}>
          <div
            role="meter"
            aria-label={I18n.t('Course progress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={map.percent_complete}
            style={{height: 12, borderRadius: 6, background: tint(color, 0.18), overflow: 'hidden'}}
          >
            <div
              style={{
                width: `${map.percent_complete}%`,
                height: '100%',
                borderRadius: 6,
                background: color,
              }}
            />
          </div>
          <div style={{marginTop: 6, color: INK.secondary}}>
            {I18n.t('%{done} of %{total} steps done (%{percent}%)', {
              done: map.requirements_completed,
              total: map.requirements_total,
              percent: map.percent_complete,
            })}
          </div>
        </div>
        {map.current_item && !done && (
          <Button color="primary" href={map.current_item.url} size="large">
            {I18n.t('Continue: %{title}', {title: map.current_item.title})}
          </Button>
        )}
      </div>

      {done && (
        <View
          as="div"
          padding="medium"
          margin="0 0 large"
          borderRadius="small"
          background="secondary"
        >
          <Text size="large" weight="bold">
            {I18n.t("You've finished every step in this course. Well done!")}
          </Text>
        </View>
      )}

      {map.units.map(unit => (
        <Unit key={unit.id} unit={unit} color={color} />
      ))}
    </View>
  )
}

function unitCounts(unit: PlayerUnit) {
  const items = unit.items.filter(item => item.type !== 'header' && item.requirement)
  return {done: items.filter(item => item.status === 'completed').length, total: items.length}
}

function Unit({unit, color}: {unit: PlayerUnit; color: string}) {
  const {done, total} = unitCounts(unit)
  const complete = total > 0 && done === total
  const locked = unit.state === 'locked'
  const status = complete
    ? I18n.t('Done')
    : locked
      ? I18n.t('Locked')
      : I18n.t('%{done} of %{total}', {done, total})

  return (
    <details className="self-paced-unit" open={!complete} style={{marginBottom: 16}}>
      <summary
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderRadius: 2,
          background: '#fff',
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.2), 0 1px 1px rgba(0,0,0,0.14), 0 2px 1px -1px rgba(0,0,0,0.12)',
          borderLeft: `4px solid ${locked ? INK.line : color}`,
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: '1.125rem',
            fontWeight: 500,
            color: locked ? INK.muted : INK.primary,
          }}
        >
          {unit.name}
        </span>
        <span
          style={{
            padding: '2px 10px',
            borderRadius: 12,
            fontSize: '0.8125rem',
            fontWeight: 500,
            background: complete ? color : tint(locked ? '#898781' : color, 0.14),
            color: complete ? '#fff' : INK.primary,
          }}
        >
          {status}
        </span>
      </summary>
      <ol style={{listStyle: 'none', margin: '8px 0 0', padding: '0 0 0 8px'}}>
        {unit.items.map((item, index) => (
          <Step key={item.id} item={item} color={color} last={index === unit.items.length - 1} />
        ))}
      </ol>
    </details>
  )
}

const STATUS_TEXT: Record<string, () => string> = {
  completed: () => I18n.t('completed'),
  current: () => I18n.t('up next'),
  available: () => I18n.t('open'),
  locked: () => I18n.t('locked'),
}

function Marker({item, color}: {item: PlayerItem; color: string}) {
  const base: React.CSSProperties = {
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    position: 'relative',
    zIndex: 1,
    flexShrink: 0,
  }
  switch (item.status) {
    case 'completed':
      return (
        <span
          aria-hidden="true"
          style={{...base, background: color, color: '#fff', fontWeight: 700, fontSize: 14}}
        >
          ✓
        </span>
      )
    case 'current':
      return (
        <span
          aria-hidden="true"
          className="self-paced-current-marker"
          style={{
            ...base,
            boxShadow: `inset 0 0 0 4px ${color}`,
            ['--sp-ring' as string]: tint(color, 0.45),
          }}
        />
      )
    case 'locked':
      return (
        <span aria-hidden="true" style={{...base, background: '#f0efec', color: INK.muted}}>
          <IconLockSolid size="x-small" />
        </span>
      )
    default:
      return <span aria-hidden="true" style={{...base, boxShadow: `inset 0 0 0 2px ${INK.line}`}} />
  }
}

function Step({item, color, last}: {item: PlayerItem; color: string; last: boolean}) {
  if (item.type === 'header') {
    return (
      <li style={{padding: '14px 0 4px 40px', fontWeight: 500, color: INK.secondary}}>
        {item.title}
      </li>
    )
  }

  const locked = item.status === 'locked'
  const current = item.status === 'current'
  const role = roleLabel(item.role)
  return (
    <li style={{display: 'grid', gridTemplateColumns: '26px 1fr', gap: 14, position: 'relative'}}>
      {/* the trail between steps */}
      {!last && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 12,
            top: 26,
            bottom: -4,
            width: 2,
            background: item.status === 'completed' ? color : INK.line,
          }}
        />
      )}
      <div style={{paddingTop: 10}}>
        <Marker item={item} color={color} />
      </div>
      <div
        style={{
          padding: '10px 12px',
          margin: '4px 0',
          borderRadius: 2,
          background: current ? tint(color, 0.1) : 'transparent',
        }}
      >
        {locked || !item.url ? (
          <span style={{color: INK.muted}}>{item.title}</span>
        ) : (
          <a href={item.url} style={{fontWeight: current ? 500 : 400}}>
            {item.title}
          </a>
        )}
        <ScreenReaderContent> ({STATUS_TEXT[item.status || 'available']()})</ScreenReaderContent>
        {(role || item.estimated_minutes) && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 4,
              fontSize: '0.8125rem',
              color: INK.secondary,
            }}
          >
            {role && (
              <span
                style={{
                  padding: '0 8px',
                  borderRadius: 10,
                  background: tint(color, locked ? 0.06 : 0.14),
                }}
              >
                {role}
              </span>
            )}
            {item.estimated_minutes ? (
              <span>{I18n.t('about %{minutes} min', {minutes: item.estimated_minutes})}</span>
            ) : null}
          </div>
        )}
      </div>
    </li>
  )
}
