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
import {render, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import doFetchApi from '@canvas/do-fetch-api-effect'
import DashboardApp from '../DashboardApp'
import type {DashboardConfig} from '../types'
import {DETAIL, ROWS} from './fixtures'

vi.mock('@canvas/do-fetch-api-effect', () => ({
  __esModule: true,
  default: vi.fn(),
}))

const mockFetch = vi.mocked(doFetchApi)

const config: DashboardConfig = {
  roster_url: '/api/v1/self_paced/roster',
  student_url: '/api/v1/self_paced/courses/:course_id/students/:student_id',
  caseload_url: '/api/v1/self_paced/caseload/:student_id',
  course_id: null,
  idle_minutes: 5,
  poll_seconds: 30,
}

function respond(rows = ROWS) {
  mockFetch.mockImplementation(({path}: {path: string}) => {
    if (path === config.roster_url) return Promise.resolve({json: {rows}} as never)
    if (path === '/api/v1/users/self/colors')
      return Promise.resolve({json: {custom_colors: {}}} as never)
    if (path.startsWith('/api/v1/self_paced/courses/'))
      return Promise.resolve({json: DETAIL} as never)
    return Promise.resolve({json: {}} as never)
  })
}

describe('DashboardApp', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    respond()
  })

  it('sums up who is working, idle, away and stuck', async () => {
    render(<DashboardApp config={config} />)

    expect(await screen.findByText('1 working now')).toBeInTheDocument()
    expect(screen.getByText('1 idle')).toBeInTheDocument()
    expect(screen.getByText('1 away')).toBeInTheDocument()
    expect(
      screen.getByText('1 student has tried the same item 3 or more times.'),
    ).toBeInTheDocument()
  })

  it('puts pinned students in their own caseload table and can show only them', async () => {
    respond(ROWS.map(row => ({...row, pinned: row.student.id === '2'})))
    render(<DashboardApp config={config} />)
    const caseload = (await screen.findByRole('heading', {name: 'My caseload'})).closest(
      'section',
    ) as HTMLElement

    expect(within(caseload).getByRole('rowheader', {name: 'Jordan Kim'})).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Only my caseload'))
    expect(screen.queryByRole('rowheader', {name: 'Maya Lopez'})).not.toBeInTheDocument()
  })

  it('pins a student through the caseload API', async () => {
    render(<DashboardApp config={config} />)
    await userEvent.click(
      await screen.findByRole('button', {name: 'Add Maya Lopez to my caseload'}),
    )

    expect(mockFetch).toHaveBeenCalledWith({path: '/api/v1/self_paced/caseload/1', method: 'PUT'})
    expect(await screen.findByRole('heading', {name: 'My caseload'})).toBeInTheDocument()
  })

  it("opens a student's details in a tray", async () => {
    render(<DashboardApp config={config} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Maya Lopez'}))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith({path: '/api/v1/self_paced/courses/4/students/1'}),
    )
    expect(await screen.findByText('Time on each item')).toBeInTheDocument()
    expect(screen.getByText('Try 2: 6 / 10')).toBeInTheDocument()
  })

  it('tells the viewer when the roster fails to load', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error('nope')))
    render(<DashboardApp config={config} />)

    expect(await screen.findByText(/The roster didn't load/)).toBeInTheDocument()
  })
})
