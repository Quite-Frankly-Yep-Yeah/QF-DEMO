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
import {Button} from '@instructure/ui-buttons'
import {IconArrowOpenEndLine, IconArrowOpenStartLine, IconLockSolid} from '@instructure/ui-icons'
import {DEFAULT_COURSE_COLOR, neighbours, tint, type PlayerMap} from '@canvas/self-paced/player'

const I18n = createI18nScope('self_paced_player')

export type PlayerBarConfig = {
  map_url: string
  player_url: string
  module_item_id: string | null
  course_color?: string | null
  watch_fraction?: number | null
  video_progress_url?: string
}

// The course player's bar on item pages: previous, the course map with the
// student's place in it, and next. Replaces the course menu and the module
// footer for students in course player courses.
export default function PlayerBar({config}: {config: PlayerBarConfig}) {
  const [map, setMap] = useState<PlayerMap | null>(null)
  const color = config.course_color || DEFAULT_COURSE_COLOR

  useEffect(() => {
    doFetchApi<PlayerMap>({path: config.map_url})
      .then(({json}) => json && setMap(json))
      .catch(() => {
        // the bar is a convenience; the page still works without it
      })
  }, [config.map_url])

  const place = map ? neighbours(map, config.module_item_id) : null
  const nextLocked = place?.next?.status === 'locked'

  return (
    <nav
      aria-label={I18n.t('Course player')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '8px 12px',
        margin: '0 0 16px',
        background: '#F5F5F5',
        borderRadius: 2,
        borderTop: `4px solid ${color}`,
        boxShadow:
          '0 1px 3px rgba(0,0,0,0.2), 0 1px 1px rgba(0,0,0,0.14), 0 2px 1px -1px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{flex: '0 0 auto'}}>
        {place?.previous?.url ? (
          <Button
            href={place.previous.url}
            renderIcon={<IconArrowOpenStartLine />}
            withBackground={false}
          >
            {I18n.t('Previous')}
          </Button>
        ) : (
          <Button
            interaction="disabled"
            renderIcon={<IconArrowOpenStartLine />}
            withBackground={false}
          >
            {I18n.t('Previous')}
          </Button>
        )}
      </div>

      <div style={{flex: '1 1 14rem', minWidth: 0, textAlign: 'center'}}>
        <a href={config.player_url} style={{fontWeight: 500}}>
          {I18n.t('Course map')}
        </a>
        {map && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 4,
            }}
          >
            <span
              role="meter"
              aria-label={I18n.t('Course progress')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={map.percent_complete}
              style={{
                display: 'inline-block',
                width: 120,
                height: 6,
                borderRadius: 3,
                background: tint(color, 0.18),
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: `${map.percent_complete}%`,
                  height: '100%',
                  background: color,
                }}
              />
            </span>
            <span style={{fontSize: '0.8125rem', color: '#52514e'}}>
              {place && place.position > 0
                ? I18n.t('Step %{position} of %{total}', {
                    position: place.position,
                    total: place.total,
                  })
                : I18n.t('%{percent}% done', {percent: map.percent_complete})}
            </span>
          </div>
        )}
      </div>

      <div style={{flex: '0 0 auto', textAlign: 'right'}}>
        {place?.next?.url && !nextLocked ? (
          <Button href={place.next.url} color="primary">
            {/* arrow after the label: Button has no end-icon placement */}
            <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
              {I18n.t('Next')}
              <IconArrowOpenEndLine />
            </span>
          </Button>
        ) : (
          <Button
            interaction="disabled"
            renderIcon={nextLocked ? <IconLockSolid /> : <IconArrowOpenEndLine />}
            aria-describedby="self-paced-next-hint"
          >
            {I18n.t('Next')}
          </Button>
        )}
        {nextLocked && (
          <div
            id="self-paced-next-hint"
            style={{fontSize: '0.75rem', color: '#52514e', marginTop: 2}}
          >
            {I18n.t('Finish this step to unlock the next one')}
          </div>
        )}
      </div>
    </nav>
  )
}
