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
import LiveBoard from '../LiveBoard'
import {NOW, ROWS} from './fixtures'

const colors = {'4': '#2a78d6', '7': '#eb6834'}

function renderBoard(rows = ROWS) {
  const onOpenStudent = vi.fn()
  render(
    <LiveBoard
      rows={rows}
      colors={colors}
      now={NOW}
      idleMinutes={5}
      onOpenStudent={onOpenStudent}
    />,
  )
  return onOpenStudent
}

describe('LiveBoard', () => {
  it('seats working and idle students in their own groups', () => {
    renderBoard()
    const working = screen
      .getByRole('heading', {name: /Working now/})
      .closest('section') as HTMLElement
    const idle = screen
      .getByRole('heading', {name: /Idle for 5\+ minutes/})
      .closest('section') as HTMLElement

    expect(within(working).getByText('Maya Lopez')).toBeInTheDocument()
    expect(within(idle).getByText('Jordan Kim')).toBeInTheDocument()
  })

  it('shows what each student is on and for how long', () => {
    renderBoard()
    const working = screen
      .getByRole('heading', {name: /Working now/})
      .closest('section') as HTMLElement

    expect(within(working).getByText('1.1 Classwork')).toBeInTheDocument()
    expect(within(working).getByText('12 min on this page')).toBeInTheDocument()
  })

  it('lists away students with when they were last active', () => {
    renderBoard()

    expect(screen.getByRole('button', {name: /Sam Rivera \(yesterday\)/})).toBeInTheDocument()
  })

  it('opens a student from their seat', async () => {
    const onOpenStudent = renderBoard()
    await userEvent.click(screen.getByRole('button', {name: /Maya Lopez/}))

    expect(onOpenStudent).toHaveBeenCalledWith({courseId: '4', studentId: '1'})
  })

  it('explains when live status is hidden from the viewer', () => {
    renderBoard(ROWS.map(row => ({...row, status: null})))

    expect(screen.getByText(/Live status isn't available/)).toBeInTheDocument()
  })
})
