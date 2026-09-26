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
import {PACE_COLORS, paceLabel, paceTone, type PaceTone} from '../pacing'

// Pace is shape + word + color, never color alone: a triangle pointing up for
// ahead, a dot for on pace, a triangle pointing down for behind, a check for
// finished.
export function PaceShape({tone, size = 12}: {tone: PaceTone; size?: number}) {
  const color = PACE_COLORS[tone]
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 12 12',
    'aria-hidden': true,
    style: {flexShrink: 0},
  }
  switch (tone) {
    case 'ahead':
      return (
        <svg {...common}>
          <path d="M6 1 L11 10 L1 10 Z" fill={color} />
        </svg>
      )
    case 'behind':
    case 'far_behind':
      return (
        <svg {...common}>
          <path d="M1 2 L11 2 L6 11 Z" fill={color} />
        </svg>
      )
    case 'finished':
      return (
        <svg {...common}>
          <path
            d="M1.5 6.5 L4.5 9.5 L10.5 2.5"
            fill="none"
            stroke={color}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="5" fill={color} />
        </svg>
      )
  }
}

export default function PaceBadge({
  daysAhead,
  finished = false,
  size = 'small',
}: {
  daysAhead: number | null | undefined
  finished?: boolean
  size?: 'small' | 'large'
}) {
  const tone = paceTone(daysAhead, finished)
  if (!tone) return <span style={{color: '#6b6a65'}}>–</span>
  const large = size === 'large'
  return (
    <span
      data-pace={tone}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: large ? 8 : 6,
        color: '#0b0b0b',
        fontWeight: large ? 500 : 400,
        fontSize: large ? '1.25rem' : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      <PaceShape tone={tone} size={large ? 16 : 12} />
      {paceLabel(daysAhead, finished)}
    </span>
  )
}
