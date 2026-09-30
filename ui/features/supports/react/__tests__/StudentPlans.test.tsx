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
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import StudentPlans from '../StudentPlans'
import type {StudentPlans as Data} from '../types'

const server = setupServer(
  http.get('/api/v1/supports/students/:id/applications', () =>
    HttpResponse.json({days: 7, applications: []}),
  ),
)
const URL = '/api/v1/supports/students/7'

const data = (overrides: Partial<Data> = {}): Data => ({
  student: {id: '7', name: 'Pat Student', sortable_name: 'Student, Pat'},
  can_manage: true,
  plans: [
    {
      id: '3',
      plan_type: '504',
      type_label: '504 plan',
      workflow_state: 'active',
      school: {id: '2', name: 'Lincoln High'},
      start_date: '2026-09-01',
      end_date: '2027-09-01',
      case_manager: {id: '9', name: 'Casey Manager'},
      source: 'manual',
      external_id: null,
      version: 2,
      notes: null,
      accommodations: [],
      acknowledgements: [],
    },
  ],
  team: [{id: '9', name: 'Casey Manager', case_manager: true}],
  schools: [{id: '2', name: 'Lincoln High'}],
  courses: [{id: '11', name: 'Algebra 1'}],
  catalog: [
    {
      id: 5,
      name: 'Extra quiz attempts',
      kind: 'extra_attempts',
      kind_label: 'Extra attempts (applied to quizzes)',
      instructions: null,
      default_parameters: {attempts: 1},
      position: 0,
    },
  ],
  ...overrides,
})

describe('StudentPlans', () => {
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it("shows the student's plan and team", async () => {
    server.use(http.get(URL, () => HttpResponse.json(data())))
    render(<StudentPlans studentId="7" onBack={vi.fn()} />)
    expect(await screen.findByRole('heading', {name: '504 plan'})).toBeInTheDocument()
    expect(screen.getByText('Casey Manager (case manager)')).toBeInTheDocument()
  })

  it('adds an accommodation from the catalog', async () => {
    let sent: Record<string, unknown> | null = null
    server.use(
      http.get(URL, () => HttpResponse.json(data())),
      http.post('/api/v1/supports/plans/3/accommodations', async ({request}) => {
        sent = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(data())
      }),
    )
    render(<StudentPlans studentId="7" onBack={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Add accommodation'}))
    await userEvent.selectOptions(screen.getByLabelText('Accommodation'), '5')
    expect(screen.getByLabelText('Extra attempts')).toHaveValue(1)
    await userEvent.click(screen.getAllByRole('button', {name: 'Add accommodation'})[0])
    expect(
      await screen.findByText(/Teachers will be asked to read the list again/),
    ).toBeInTheDocument()
    expect(sent).toMatchObject({
      accommodation_type_id: '5',
      parameters: {attempts: 1},
      course_ids: [],
    })
  })

  it('offers no editing to someone who can only read', async () => {
    server.use(http.get(URL, () => HttpResponse.json(data({can_manage: false}))))
    render(<StudentPlans studentId="7" onBack={vi.fn()} />)
    await screen.findByRole('heading', {name: '504 plan'})
    expect(screen.queryByRole('button', {name: 'Edit plan'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Add accommodation'})).not.toBeInTheDocument()
  })

  it("says so when the viewer can't see the plan", async () => {
    server.use(http.get(URL, () => HttpResponse.json({}, {status: 401})))
    render(<StudentPlans studentId="7" onBack={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent("You can't see this student's plan")
  })
})
