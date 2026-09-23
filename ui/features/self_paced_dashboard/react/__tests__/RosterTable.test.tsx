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

import React from 'react'
import {render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RosterTable, {sortRows} from '../RosterTable'
import {NOW, ROWS} from './fixtures'

const colors = {'4': '#2a78d6', '7': '#eb6834'}

function renderTable(overrides = {}) {
  const props = {
    caption: 'Students',
    rows: ROWS,
    colors,
    now: NOW,
    onOpenStudent: vi.fn(),
    onTogglePin: vi.fn(),
    ...overrides,
  }
  render(<RosterTable {...props} />)
  return props
}

function studentOrder() {
  return screen.getAllByRole('rowheader').map(cell => cell.textContent)
}

describe('RosterTable', () => {
  it('lists working students first, then idle, then away', () => {
    renderTable()

    expect(studentOrder()).toEqual(['Maya Lopez', 'Jordan Kim', 'Sam Rivera'])
  })

  it('sorts by progress, most complete first, when the column is chosen', async () => {
    renderTable()
    await userEvent.click(screen.getByRole('button', {name: /Progress/}))

    expect(studentOrder()).toEqual(['Jordan Kim', 'Maya Lopez', 'Sam Rivera'])
  })

  it('shows a stuck badge after three tries on the same item', () => {
    renderTable()
    const jordan = screen.getByRole('rowheader', {name: 'Jordan Kim'}).closest('tr') as HTMLElement

    expect(within(jordan).getByText('4 tries')).toBeInTheDocument()
  })

  it('opens a student and pins them', async () => {
    const props = renderTable()
    await userEvent.click(screen.getByRole('button', {name: 'Maya Lopez'}))
    await userEvent.click(screen.getByRole('button', {name: 'Add Maya Lopez to my caseload'}))

    expect(props.onOpenStudent).toHaveBeenCalledWith({courseId: '4', studentId: '1'})
    expect(props.onTogglePin).toHaveBeenCalledWith(ROWS[0])
  })

  it('shows a dash where the grade is hidden', () => {
    renderTable()
    const sam = screen.getByRole('rowheader', {name: 'Sam Rivera'}).closest('tr') as HTMLElement

    expect(within(sam).getByText('–')).toBeInTheDocument()
  })
})

describe('sortRows', () => {
  it('keeps missing grades last in both directions', () => {
    const names = (direction: 'ascending' | 'descending') =>
      sortRows(ROWS, 'score', direction).map(row => row.student.name)

    expect(names('ascending').at(-1)).toBe('Sam Rivera')
    expect(names('descending').at(-1)).toBe('Sam Rivera')
  })
})
