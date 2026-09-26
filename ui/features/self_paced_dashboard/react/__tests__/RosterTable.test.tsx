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
import {render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RosterTable, {sortRows} from '../RosterTable'
import {NOW, ROWS, rosterRow} from './fixtures'

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
  return screen.getAllByRole('rowheader').map(cell => within(cell).getByRole('button').textContent)
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

describe('RosterTable pace', () => {
  const paced = [
    rosterRow({id: '1', name: 'Maya Lopez', days_behind: -2}),
    rosterRow({id: '2', name: 'Jordan Kim', days_behind: 4}),
    rosterRow({id: '3', name: 'Sam Rivera', days_behind: null}),
  ]

  it('sorts by pace, furthest behind first', async () => {
    renderTable({rows: paced})
    await userEvent.click(screen.getByRole('button', {name: /Pace/}))

    expect(studentOrder()).toEqual(['Jordan Kim', 'Maya Lopez', 'Sam Rivera'])
  })

  it('says how far ahead or behind each student is', () => {
    renderTable({rows: paced})
    const row = screen.getByRole('rowheader', {name: 'Jordan Kim'}).closest('tr') as HTMLElement

    expect(within(row).getByText('4 days behind')).toBeInTheDocument()
  })

  it('leaves the column out when no course is paced', () => {
    renderTable({rows: ROWS.map(row => ({...row, days_behind: null}))})

    expect(screen.queryByRole('columnheader', {name: /Pace/})).not.toBeInTheDocument()
  })
})

describe('RosterTable grouping', () => {
  const biology = {id: '7', name: 'Biology', course_code: 'BIO'}
  const twoClasses = [
    rosterRow({id: '1', name: 'Maya Lopez', percent_complete: 40}),
    rosterRow({id: '1', name: 'Maya Lopez', course: biology, status: 'away', percent_complete: 80}),
    rosterRow({id: '2', name: 'Jordan Kim'}),
  ]

  it('shows a student in two classes once', () => {
    renderTable({rows: twoClasses})

    expect(studentOrder()).toEqual(['Jordan Kim', 'Maya Lopez'])
    const maya = screen.getByRole('rowheader', {name: 'Maya Lopez'}).closest('tr') as HTMLElement
    expect(within(maya).getByText('2 classes')).toBeInTheDocument()
  })

  it('leaves class details out of the collapsed row', () => {
    renderTable({rows: twoClasses})
    const maya = screen.getByRole('rowheader', {name: 'Maya Lopez'}).closest('tr') as HTMLElement

    expect(within(maya).queryByText('1.1 Classwork')).not.toBeInTheDocument()
    expect(within(maya).queryByRole('meter')).not.toBeInTheDocument()
    expect(within(maya).queryByText('82.5%')).not.toBeInTheDocument()
  })

  it('opens a row for each class', async () => {
    const props = renderTable({rows: twoClasses})
    await userEvent.click(screen.getByRole('button', {name: "Show Maya Lopez's classes"}))
    await userEvent.click(screen.getByRole('button', {name: 'Maya Lopez, Biology'}))

    expect(props.onOpenStudent).toHaveBeenCalledWith({courseId: '7', studentId: '1'})
    expect(screen.getByRole('button', {name: "Hide Maya Lopez's classes"})).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('opens every student at once', () => {
    renderTable({rows: twoClasses, expandAll: true})

    expect(screen.getByRole('button', {name: 'Maya Lopez, Algebra 1'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Maya Lopez, Biology'})).toBeInTheDocument()
  })

  it('gives single-class students no expand button', () => {
    renderTable({rows: twoClasses})

    expect(
      screen.queryByRole('button', {name: "Show Jordan Kim's classes"}),
    ).not.toBeInTheDocument()
  })
})

describe('RosterTable paging', () => {
  const many = Array.from({length: 60}, (_, i) =>
    rosterRow({id: String(100 + i), name: `Student ${String(i).padStart(2, '0')} Test`}),
  )

  it('draws the first 50 students and more on request', async () => {
    renderTable({rows: many})

    expect(screen.getAllByRole('rowheader')).toHaveLength(50)
    expect(screen.getByText('Showing 50 of 60 students')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Show 10 more'}))
    expect(screen.getAllByRole('rowheader')).toHaveLength(60)
  })
})
