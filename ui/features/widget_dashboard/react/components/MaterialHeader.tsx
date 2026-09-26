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
import {Heading} from '@instructure/ui-heading'
import {ACCENTS, APP_BAR, ELEVATION, ink, ROBOTO} from '../materialTheme'

type Props = {
  title: string
  headingTestId: string
  actions?: React.ReactNode
  children?: React.ReactNode
  now?: Date
}

// The dashboard's app bar: a band of every widget color along the top, the
// date, and the greeting in big light type. The tabs below sit on the same
// color, so the two read as one bar.
export default function MaterialHeader({
  title,
  headingTestId,
  actions,
  children,
  now = new Date(),
}: Props) {
  const date = now.toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})
  return (
    <header
      data-testid="material-dashboard-header"
      style={{
        background: ink(APP_BAR),
        color: '#fff',
        borderRadius: '2px 2px 0 0',
        boxShadow: ELEVATION[4],
        fontFamily: ROBOTO,
        overflow: 'hidden',
      }}
    >
      <div aria-hidden="true" style={{display: 'flex', height: 6}}>
        {ACCENTS.map(color => (
          <span key={color} style={{flex: 1, background: color}} />
        ))}
      </div>
      <div style={{padding: 24}}>
        <div style={{fontSize: '1rem', opacity: 0.88, marginBottom: 4}}>{date}</div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: '12px 16px',
          }}
        >
          <div style={{flex: '1 1 20rem', minWidth: 0}}>
            <Heading
              level="h1"
              margin="0"
              color="primary-inverse"
              data-testid={headingTestId}
              themeOverride={{primaryInverseColor: '#ffffff'}}
            >
              {title}
            </Heading>
          </div>
          {actions && (
            <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8}}>
              {actions}
            </div>
          )}
        </div>
        {children && <div style={{marginTop: 16}}>{children}</div>}
      </div>
    </header>
  )
}
