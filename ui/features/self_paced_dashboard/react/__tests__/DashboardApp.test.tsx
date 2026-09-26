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
  pacing_url: '/api/v1/courses/:course_id/self_paced/pacing?student_id=:student_id',
  student_pacing_url: '/api/v1/courses/:course_id/self_paced/pacing/:student_id',
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
    // the page keeps its filters in the address bar, so start each test clean
    window.history.replaceState(null, '', '/self_paced/dashboard')
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

describe('DashboardApp interventions', () => {
  const withTools: DashboardConfig = {
    ...config,
    interventions_url: '/api/v1/self_paced/courses/:course_id/students/:student_id/interventions',
    bulk_interventions_url: '/api/v1/self_paced/interventions/bulk',
  }
  const support = {
    tools: {
      unlock: true,
      mark_complete: true,
      exempt: true,
      exempt_graded: true,
      extra_attempts: true,
      reset_attempt: true,
      adjust_target: true,
      note: true,
      message: true,
    },
    log: [
      {
        id: '1',
        kind: 'note',
        created_at: '2026-09-22T14:00:00Z',
        actor: {id: '9', name: 'Ms. Ortiz'},
        real_actor: null,
        item: null,
        reason: null,
        payload: {note_id: '5'},
        bulk: false,
      },
    ],
    notes: [
      {
        id: '5',
        body: 'Parent called about absences',
        created_at: '2026-09-22T14:00:00Z',
        author: {id: '9', name: 'Ms. Ortiz'},
        course: {id: '4', name: 'Algebra 1'},
        can_delete: true,
      },
    ],
  }
  const detail = {
    ...DETAIL,
    items: DETAIL.items.map(item => ({
      ...item,
      overrides: [],
      graded: item.type !== 'WikiPage',
      attempts_limited: item.type !== 'WikiPage',
    })),
  }

  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation(({path}: {path: string}) => {
      if (path === config.roster_url) return Promise.resolve({json: {rows: ROWS}} as never)
      if (path.endsWith('/interventions')) return Promise.resolve({json: support} as never)
      if (path.startsWith('/api/v1/self_paced/courses/'))
        return Promise.resolve({json: detail} as never)
      return Promise.resolve({json: {}} as never)
    })
    window.history.replaceState(null, '', '/self_paced/dashboard')
  })

  const interventionsPath = '/api/v1/self_paced/courses/4/students/1/interventions'

  it('shows notes and the history of help in the tray', async () => {
    render(<DashboardApp config={withTools} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Maya Lopez'}))

    expect(await screen.findByText('Parent called about absences')).toBeInTheDocument()
    expect(screen.getByText('Added a note')).toBeInTheDocument()
  })

  it('unlocks an item from its menu, with a reason for the log', async () => {
    render(<DashboardApp config={withTools} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Maya Lopez'}))
    await userEvent.click(await screen.findByRole('button', {name: 'Actions for 1.1 Classwork'}))
    await userEvent.click(await screen.findByRole('menuitem', {name: 'Unlock'}))
    await userEvent.type(screen.getByLabelText(/Reason/), 'Absent Monday')
    await userEvent.click(screen.getByRole('button', {name: 'Unlock'}))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith({
        path: interventionsPath,
        method: 'POST',
        body: {
          kind: 'unlock',
          content_tag_id: '101',
          override_kind: undefined,
          reason: 'Absent Monday',
        },
      }),
    )
  })

  it('sends the student a message from the tray header', async () => {
    render(<DashboardApp config={withTools} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Maya Lopez'}))
    await userEvent.click(await screen.findByRole('button', {name: 'Message'}))
    await userEvent.type(screen.getByLabelText('Subject'), 'Check 1.1')
    await userEvent.type(screen.getByLabelText(/^Message/, {selector: 'textarea'}), 'See me at 2')
    await userEvent.click(screen.getByRole('button', {name: 'Send'}))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith({
        path: interventionsPath,
        method: 'POST',
        body: {kind: 'message', subject: 'Check 1.1', body: 'See me at 2'},
      }),
    )
  })

  it('opens the bulk bar when students are ticked', async () => {
    render(<DashboardApp config={withTools} />)
    await userEvent.click(await screen.findByRole('checkbox', {name: 'Select Maya Lopez'}))

    expect(screen.getByText('1 student selected')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Clear selection'}))
    expect(screen.queryByText('1 student selected')).not.toBeInTheDocument()
  })

  it('has no checkboxes or item menus without the intervention tools', async () => {
    render(<DashboardApp config={config} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Maya Lopez'}))
    await screen.findByText('Time on each item')

    expect(screen.queryByRole('checkbox', {name: 'Select Maya Lopez'})).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {name: 'Actions for 1.1 Classwork'}),
    ).not.toBeInTheDocument()
  })
})

describe('DashboardApp course pages', () => {
  const withPages: DashboardConfig = {
    ...config,
    course_page_url: '/self_paced/courses/:course_id',
    course_page_ids: ['4'],
  }

  beforeEach(() => {
    mockFetch.mockReset()
    respond()
    window.history.replaceState(null, '', '/self_paced/dashboard')
  })

  it("links a course chip to the course's page, where it has one", async () => {
    render(<DashboardApp config={withPages} />)
    const maya = (await screen.findByRole('rowheader', {name: 'Maya Lopez'})).closest(
      'tr',
    ) as HTMLElement
    const sam = screen.getByRole('rowheader', {name: 'Sam Rivera'}).closest('tr') as HTMLElement

    expect(within(maya).getByRole('link', {name: 'Algebra 1'})).toHaveAttribute(
      'href',
      '/self_paced/courses/4',
    )
    expect(within(sam).queryByRole('link', {name: 'Biology'})).not.toBeInTheDocument()
  })

  it("links the student's panel to the course page", async () => {
    render(<DashboardApp config={withPages} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Maya Lopez'}))

    expect(await screen.findByRole('link', {name: 'Open Algebra 1'})).toHaveAttribute(
      'href',
      '/self_paced/courses/4',
    )
  })

  it('opens the student named in the address bar', async () => {
    window.history.replaceState(null, '', '/self_paced/dashboard?student_id=1')
    render(<DashboardApp config={withPages} />)

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith({path: '/api/v1/self_paced/courses/4/students/1'}),
    )
  })
})

describe('DashboardApp toolbar', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    respond()
    window.history.replaceState(null, '', '/self_paced/dashboard')
  })

  it('searches students by name and keeps the search in the address bar', async () => {
    render(<DashboardApp config={config} />)
    await userEvent.type(await screen.findByLabelText('Search students'), 'kim')

    expect(screen.getByRole('rowheader', {name: 'Jordan Kim'})).toBeInTheDocument()
    expect(screen.queryByRole('rowheader', {name: 'Maya Lopez'})).not.toBeInTheDocument()
    expect(window.location.search).toBe('?q=kim')
  })

  it('says so when nobody matches, and clears the search', async () => {
    render(<DashboardApp config={config} />)
    await userEvent.type(await screen.findByLabelText('Search students'), 'zzz')

    expect(screen.getByText('No students match "zzz".')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Clear filters'}))
    expect(screen.getByRole('rowheader', {name: 'Maya Lopez'})).toBeInTheDocument()
  })

  it('filters to stuck students with a chip', async () => {
    render(<DashboardApp config={config} />)
    await userEvent.click(await screen.findByRole('button', {name: /Stuck/}))

    expect(screen.getByRole('button', {name: /Stuck/})).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getAllByRole('rowheader').map(cell => within(cell).getByRole('button').textContent),
    ).toEqual(['Jordan Kim'])
  })

  it('jumps to the search box with /', async () => {
    render(<DashboardApp config={config} />)
    await screen.findByLabelText('Search students')
    await userEvent.keyboard('/')

    expect(screen.getByLabelText('Search students')).toHaveFocus()
  })

  it('opens with the view from the address bar', async () => {
    window.history.replaceState(null, '', '/self_paced/dashboard?q=sam')
    render(<DashboardApp config={config} />)

    expect(await screen.findByLabelText('Search students')).toHaveValue('sam')
    expect(screen.getByRole('rowheader', {name: 'Sam Rivera'})).toBeInTheDocument()
  })
})
