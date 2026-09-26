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
import doFetchApi from '@canvas/do-fetch-api-effect'
import CourseApp from '../CourseApp'
import type {CourseConfig, CourseSummary, DashboardConfig} from '../types'
import {DETAIL, rosterRow} from './fixtures'

vi.mock('@canvas/do-fetch-api-effect', () => ({
  __esModule: true,
  default: vi.fn(),
}))

const mockFetch = vi.mocked(doFetchApi)

const config: DashboardConfig = {
  roster_url: '/api/v1/self_paced/roster?course_id=4',
  student_url: '/api/v1/self_paced/courses/:course_id/students/:student_id',
  caseload_url: '/api/v1/self_paced/caseload/:student_id',
  pacing_url: '/api/v1/courses/:course_id/self_paced/pacing?student_id=:student_id',
  student_pacing_url: '/api/v1/courses/:course_id/self_paced/pacing/:student_id',
  course_id: '4',
  idle_minutes: 5,
  poll_seconds: 30,
  dashboard_url: '/self_paced/dashboard',
  course_ids: ['4', '7'],
}

const course: CourseConfig = {
  course: {id: '4', name: 'Algebra 1', course_code: 'ALG1'},
  summary_url: '/api/v1/self_paced/courses/4/summary',
  dashboard_url: '/self_paced/dashboard?course_id=4',
  edit_links: [
    {label: 'Course Player setup', url: '/courses/4/player_setup'},
    {label: 'Modules', url: '/courses/4/modules'},
  ],
}

const ROWS = [
  rosterRow({
    id: '1',
    name: 'Maya Lopez',
    current_item: {id: '101', title: '1.1 Check', type: 'Quizzes::Quiz'},
  }),
  rosterRow({
    id: '2',
    name: 'Jordan Kim',
    attempts_on_current_item: 4,
    current_item: {id: '201', title: '2.1 Check', type: 'Quizzes::Quiz'},
  }),
]

const SUMMARY: CourseSummary = {
  course: course.course,
  units: [
    {
      id: '10',
      name: 'Unit 1',
      item_ids: ['100', '101'],
      students_here: 1,
      stuck_here: 0,
      completed: 1,
    },
    {id: '20', name: 'Unit 2', item_ids: ['201'], students_here: 1, stuck_here: 1, completed: 0},
  ],
  hard_items: [
    {
      id: '201',
      title: '2.1 Check',
      module: 'Unit 2',
      students_tried: 2,
      average_tries: 3.5,
      needed_many_tries: 1,
      students_on_it: 1,
    },
  ],
  items: [{id: '201', title: '2.1 Check', module: 'Unit 2', graded: true, attempts_limited: true}],
  chart: null,
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
}

function renderApp(overrides: Partial<CourseConfig> = {}) {
  render(<CourseApp config={config} course={{...course, ...overrides}} />)
}

describe('CourseApp', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation(({path}: {path: string}) => {
      if (path === config.roster_url) return Promise.resolve({json: {rows: ROWS}} as never)
      if (path === course.summary_url) return Promise.resolve({json: SUMMARY} as never)
      if (path.startsWith('/api/v1/self_paced/courses/'))
        return Promise.resolve({json: DETAIL} as never)
      return Promise.resolve({json: {}} as never)
    })
    window.history.replaceState(null, '', '/self_paced/courses/4')
  })

  it('sums up the class in the header', async () => {
    renderApp()

    const header = (await screen.findByRole('heading', {name: 'Algebra 1', level: 1})).closest(
      'header',
    ) as HTMLElement
    expect(within(header).getByText('2 students')).toBeInTheDocument()
    expect(within(header).getByText('1 stuck')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'All students'})).toHaveAttribute(
      'href',
      '/self_paced/dashboard?course_id=4',
    )
  })

  it('shows only the students on a unit when it is chosen', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', {name: /^Unit 2/}))

    expect(screen.getByRole('heading', {name: 'Students on Unit 2'})).toBeInTheDocument()
    expect(screen.getByRole('rowheader', {name: 'Jordan Kim'})).toBeInTheDocument()
    expect(screen.queryByRole('rowheader', {name: 'Maya Lopez'})).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', {name: 'Show every unit'}))
    expect(screen.getByRole('rowheader', {name: 'Maya Lopez'})).toBeInTheDocument()
  })

  it('lists the items that take many tries', async () => {
    renderApp()
    const card = (await screen.findByRole('heading', {name: 'Items that take many tries'})).closest(
      'section',
    ) as HTMLElement

    expect(within(card).getByText('2.1 Check')).toBeInTheDocument()
    expect(within(card).getByText('3.5 tries on average')).toBeInTheDocument()
  })

  it('offers course editors the editing screens', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', {name: 'Edit course'}))

    expect(screen.getByRole('menuitem', {name: 'Modules'})).toHaveAttribute(
      'href',
      '/courses/4/modules',
    )
  })

  it('has no edit button for mentors', async () => {
    renderApp({edit_links: null})
    await screen.findByRole('heading', {name: 'Algebra 1', level: 1})

    expect(screen.queryByRole('button', {name: 'Edit course'})).not.toBeInTheDocument()
  })

  it("links a student's panel to all their classes", async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', {name: 'Maya Lopez'}))

    expect(await screen.findByRole('link', {name: 'All their classes'})).toHaveAttribute(
      'href',
      '/self_paced/dashboard?student_id=1',
    )
  })
})
