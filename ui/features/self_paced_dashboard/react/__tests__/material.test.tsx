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

import React, {useState} from 'react'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {AppBarTabs, darkenForWhiteText} from '../material'

describe('darkenForWhiteText', () => {
  it('darkens light course colors more than dark ones', () => {
    const yellow = darkenForWhiteText('#eda100')
    const violet = darkenForWhiteText('#4a3aa7')

    expect(yellow).toBeGreaterThan(violet)
    expect(violet).toBe(0.12)
  })
})

describe('AppBarTabs', () => {
  function Harness() {
    const [selected, setSelected] = useState('roster')
    return (
      <AppBarTabs
        label="Views"
        selected={selected}
        onSelect={setSelected}
        tabs={[
          {id: 'roster', label: 'Roster'},
          {id: 'live', label: 'Live'},
        ]}
      />
    )
  }

  it('selects a tab on click', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('tab', {name: 'Live'}))

    expect(screen.getByRole('tab', {name: 'Live'})).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', {name: 'Roster'})).toHaveAttribute('aria-selected', 'false')
  })

  it('moves between tabs with the arrow keys', async () => {
    render(<Harness />)
    screen.getByRole('tab', {name: 'Roster'}).focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', {name: 'Live'})).toHaveFocus()
    expect(screen.getByRole('tab', {name: 'Live'})).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', {name: 'Roster'})).toHaveFocus()
  })

  it('keeps only the selected tab in the tab order', () => {
    render(<Harness />)

    expect(screen.getByRole('tab', {name: 'Live'})).toHaveAttribute('tabindex', '-1')
  })
})
