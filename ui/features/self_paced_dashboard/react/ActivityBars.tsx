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

import React, {useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {INK} from './colors'
import {formatDuration} from './format'
import type {ActivityDay} from './types'

const I18n = createI18nScope('self_paced_dashboard')

const HEIGHT = 96
const GAP = 2

function dayLabel(iso: string): string {
  // noon, so a time zone offset can't push the date into the neighbouring day
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Active minutes per day as a single-series bar chart in the course color.
// Hovering or focusing a bar shows that day; a table carries the same data
// for screen readers.
export default function ActivityBars({days, color}: {days: ActivityDay[]; color: string}) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(60, ...days.map(d => d.active_seconds))
  const count = days.length
  const barWidth = count > 0 ? (100 - GAP * (count - 1) * 0.25) / count : 0
  const highlighted = active === null ? null : days[active]

  return (
    <figure style={{margin: 0}}>
      <div
        style={{minHeight: '1.5rem', color: INK.secondary, fontSize: '0.875rem'}}
        aria-live="polite"
      >
        {highlighted
          ? I18n.t('%{day}: %{duration} active, %{count} submissions', {
              day: dayLabel(highlighted.day),
              duration: formatDuration(highlighted.active_seconds),
              count: highlighted.submissions,
            })
          : I18n.t('Hover a day to see its details')}
      </div>
      <svg
        viewBox={`0 0 100 ${HEIGHT}`}
        preserveAspectRatio="none"
        width="100%"
        height={HEIGHT}
        role="img"
        aria-hidden="true"
        style={{display: 'block', overflow: 'visible'}}
        onMouseLeave={() => setActive(null)}
      >
        <line
          x1={0}
          x2={100}
          y1={HEIGHT - 0.5}
          y2={HEIGHT - 0.5}
          stroke="#c3c2b7"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {days.map((day, index) => {
          const x = index * (barWidth + GAP * 0.25)
          const h =
            day.active_seconds === 0 ? 0 : Math.max(3, (day.active_seconds / max) * (HEIGHT - 4))
          return (
            <g key={day.day} onMouseEnter={() => setActive(index)}>
              {/* hit target: the full column, bigger than the bar */}
              <rect x={x} y={0} width={barWidth + GAP * 0.25} height={HEIGHT} fill="transparent" />
              <rect
                x={x}
                y={HEIGHT - h}
                width={barWidth}
                height={h}
                rx={0.8}
                fill={color}
                opacity={active === null || active === index ? 1 : 0.45}
              />
            </g>
          )
        })}
      </svg>
      <figcaption
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: INK.muted,
          fontSize: '0.75rem',
          marginTop: 4,
        }}
      >
        <span>{days[0] ? dayLabel(days[0].day) : ''}</span>
        <span>{I18n.t('Today')}</span>
      </figcaption>
      <ScreenReaderContent>
        <table>
          <caption>{I18n.t('Active time per day')}</caption>
          <thead>
            <tr>
              <th scope="col">{I18n.t('Day')}</th>
              <th scope="col">{I18n.t('Active time')}</th>
              <th scope="col">{I18n.t('Submissions')}</th>
            </tr>
          </thead>
          <tbody>
            {days.map(day => (
              <tr key={day.day}>
                <th scope="row">{dayLabel(day.day)}</th>
                <td>{formatDuration(day.active_seconds)}</td>
                <td>{day.submissions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScreenReaderContent>
    </figure>
  )
}
