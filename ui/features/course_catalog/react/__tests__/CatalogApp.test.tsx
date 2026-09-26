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
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import CatalogApp from '../CatalogApp'
import type {CatalogConfig} from '../types'

const config: CatalogConfig = {
  account: {id: '1', name: 'Northside High'},
  can_create: true,
  dashboard_url: '/',
}

const COURSES = [
  {
    id: 10,
    name: 'Algebra 1',
    course_code: 'ALG1',
    workflow_state: 'available',
    total_students: 24,
    account_name: 'Math',
    term: {id: 3, name: 'Fall 2026'},
    teachers: [{id: 5, display_name: 'Ms. Ruiz'}],
  },
  {
    id: 11,
    name: 'Biology',
    course_code: 'BIO',
    workflow_state: 'created',
    total_students: 0,
    account_name: 'Science',
    term: {id: 3, name: 'Fall 2026'},
    teachers: [],
  },
]

const requests: URL[] = []
const enrollments: unknown[] = []

const server = setupServer(
  http.get('/api/v1/accounts/1/courses', ({request}) => {
    requests.push(new URL(request.url))
    return HttpResponse.json(COURSES)
  }),
  http.get('/api/v1/accounts/1/terms', () =>
    HttpResponse.json({enrollment_terms: [{id: 3, name: 'Fall 2026'}]}),
  ),
  http.get('/api/v1/accounts/1/sub_accounts', () => HttpResponse.json([{id: 8, name: 'Math'}])),
  http.get('/api/v1/accounts/1/users', () => HttpResponse.json([{id: 7, name: 'Maya Lopez'}])),
  http.get('/api/v1/users/7/courses', () => HttpResponse.json([{id: 11}])),
  http.post('/api/v1/courses/10/enrollments', async ({request}) => {
    enrollments.push(await request.json())
    return HttpResponse.json({id: 99})
  }),
)

describe('CatalogApp', () => {
  beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
  afterAll(() => server.close())
  beforeEach(() => {
    requests.length = 0
    enrollments.length = 0
  })
  afterEach(() => server.resetHandlers())

  it('lists the courses with the facts an admin picks by', async () => {
    render(<CatalogApp config={config} />)
    const card = await screen.findByRole('region', {name: 'Algebra 1'})
    expect(within(card).getByText('Ms. Ruiz')).toBeInTheDocument()
    expect(within(card).getByText('24')).toBeInTheDocument()
    expect(within(card).getByText('Published')).toBeInTheDocument()
    expect(screen.getByRole('region', {name: 'Biology'})).toBeInTheDocument()
    expect(await screen.findByText('2 courses')).toBeInTheDocument()
    expect(requests[0].searchParams.getAll('include[]')).toEqual([
      'term',
      'teachers',
      'total_students',
      'account_name',
    ])
  })

  it('searches after typing stops and filters through the panel', async () => {
    const user = userEvent.setup()
    render(<CatalogApp config={config} />)
    await screen.findByRole('region', {name: 'Algebra 1'})

    await user.type(screen.getByLabelText('Search by course name, code or ID'), 'alg')
    // the search applies 300 ms after typing stops; waitFor's polling doesn't
    // let that timer run, so let real time pass first
    await new Promise(resolve => setTimeout(resolve, 600))
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('search_term')).toBe('alg'))

    await user.click(await screen.findByLabelText('Fall 2026'))
    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.getAll('enrollment_term_id[]')).toEqual(['3']),
    )
    await user.click(screen.getByRole('button', {name: 'Clear all'}))
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('search_term')).toBeNull())
  })

  it('marks the courses a chosen student is in and enrolls them in another', async () => {
    const user = userEvent.setup()
    render(<CatalogApp config={config} />)
    await screen.findByRole('region', {name: 'Algebra 1'})
    expect(screen.queryByRole('button', {name: /^Enroll/})).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Pick courses for a student'), 'may')
    await user.click(await screen.findByRole('button', {name: 'Maya Lopez'}))

    expect(await screen.findByText('Already enrolled')).toBeInTheDocument()
    await user.click(screen.getByRole('button', {name: 'Enroll Maya Lopez in Algebra 1'}))
    const dialog = screen.getByRole('dialog', {name: 'Enroll Maya Lopez?'})
    await user.click(within(dialog).getByRole('button', {name: 'Enroll'}))

    expect(await screen.findByText('Maya Lopez is enrolled in Algebra 1.')).toBeInTheDocument()
    expect(enrollments).toEqual([
      {enrollment: {user_id: '7', type: 'StudentEnrollment', enrollment_state: 'active'}},
    ])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
