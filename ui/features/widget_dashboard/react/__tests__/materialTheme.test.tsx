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
import {render, screen} from '@testing-library/react'
import {InstUISettingsProvider} from '@instructure/emotion'
import {Heading} from '@instructure/ui-heading'
import MaterialHeader from '../components/MaterialHeader'
import {ACCENTS, APP_BAR, accentFor, contrast, ink, materialTheme} from '../materialTheme'

describe('ink', () => {
  it('darkens every widget color until it reads on white', () => {
    ;[APP_BAR, ...ACCENTS].forEach(color => {
      expect(contrast(ink(color), '#ffffff')).toBeGreaterThanOrEqual(4.5)
    })
  })

  it('leaves a color that already reads alone', () => {
    expect(ink('#4a3aa7')).toBe('#4a3aa7')
  })
})

describe('accentFor', () => {
  it('goes round the palette in order', () => {
    expect([accentFor(0), accentFor(1), accentFor(8)]).toEqual([ACCENTS[0], ACCENTS[1], ACCENTS[0]])
  })
})

describe('materialTheme', () => {
  it('sets headings in big light Roboto', () => {
    render(
      <InstUISettingsProvider theme={materialTheme(false)}>
        <Heading level="h1">Hi, Ms. Ortiz!</Heading>
      </InstUISettingsProvider>,
    )
    const style = getComputedStyle(screen.getByRole('heading', {name: 'Hi, Ms. Ortiz!'}))

    expect(style.fontFamily).toContain('Roboto')
    expect(style.fontWeight).toBe('300')
  })
})

describe('MaterialHeader', () => {
  it('shows the date, the greeting and the actions', () => {
    render(
      <MaterialHeader
        title="Hi, Ms. Ortiz!"
        headingTestId="greeting"
        now={new Date(2026, 8, 24, 12)}
        actions={<button type="button">Customize</button>}
      />,
    )

    expect(screen.getByTestId('greeting')).toHaveTextContent('Hi, Ms. Ortiz!')
    expect(screen.getByText(/September 24/)).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Customize'})).toBeInTheDocument()
  })
})
