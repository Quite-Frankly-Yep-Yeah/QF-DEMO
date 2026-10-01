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
import GradingQueueApp from '../GradingQueueApp'
import type {QueueResult, QueueRow} from '../types'

const URL_PATH = '/api/v1/workflow/grading_queue'

const row = (overrides: Partial<QueueRow> = {}): QueueRow => ({
  id: '1',
  tier: 1,
  reason: 'Maya Lopez is waiting on this to move on',
  student: {id: '5', name: 'Maya Lopez'},
  course: {id: '2', name: 'Algebra 1'},
  unit: {id: '3', name: 'Unit 1'},
  item: {id: '4', title: 'Check 1'},
  submitted_at: '2026-09-29T12:00:00Z',
  due_at: null,
  speed_grader_url: '/courses/2/gradebook/speed_grader?assignment_id=4&student_id=5',
  ...overrides,
})

const result = (rows: QueueRow[], overrides: Partial<QueueResult> = {}): QueueResult => ({
  rows,
  page: 1,
  per_page: 25,
  total: rows.length,
  truncated: false,
  tier_counts: {1: 1, 2: 0, 3: 0, 4: 0},
  turnaround: {'2': {median_hours: 15, graded_count: 2}},
  facets: {
    courses: [
      {id: '2', name: 'Algebra 1'},
      {id: '9', name: 'Biology'},
    ],
    units: [
      {id: '3', name: 'Unit 1', course_id: '2'},
      {id: '8', name: 'Cells', course_id: '9'},
    ],
    students: [{id: '5', name: 'Maya Lopez'}],
  },
  ...overrides,
})

const requests: URL[] = []
const server = setupServer(
  http.get(URL_PATH, ({request}) => {
    requests.push(new URL(request.url))
    return HttpResponse.json(result([row()]))
  }),
)

beforeAll(() => server.listen())
beforeEach(() => {
  requests.length = 0
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('GradingQueueApp', () => {
  it('shows each row with its reason and a SpeedGrader link', async () => {
    render(<GradingQueueApp queueUrl={URL_PATH} />)
    expect(await screen.findByText('Maya Lopez is waiting on this to move on')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: /grade check 1/i})).toHaveAttribute(
      'href',
      '/courses/2/gradebook/speed_grader?assignment_id=4&student_id=5',
    )
  })

  it('shows the turnaround for the viewer', async () => {
    render(<GradingQueueApp queueUrl={URL_PATH} />)
    expect(await screen.findByText(/median 15 hours/i)).toBeInTheDocument()
  })

  it('asks for held-up work only when the toggle is on', async () => {
    render(<GradingQueueApp queueUrl={URL_PATH} />)
    await screen.findByText(/waiting on this/)
    expect(requests.at(-1)?.searchParams.get('held_up')).toBe('false')

    await userEvent.click(screen.getByLabelText(/held up only/i))
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('held_up')).toBe('true'))
  })

  it('says so when nothing is waiting', async () => {
    server.use(http.get(URL_PATH, () => HttpResponse.json(result([]))))
    render(<GradingQueueApp queueUrl={URL_PATH} />)
    expect(await screen.findByText(/nothing is waiting/i)).toBeInTheDocument()
  })

  it('warns when the list was cut off', async () => {
    server.use(http.get(URL_PATH, () => HttpResponse.json(result([row()], {truncated: true}))))
    render(<GradingQueueApp queueUrl={URL_PATH} />)
    expect(await screen.findByText(/showing the first 500/i)).toBeInTheDocument()
  })

  it('says so when the queue cannot be loaded', async () => {
    server.use(http.get(URL_PATH, () => new HttpResponse(null, {status: 500})))
    render(<GradingQueueApp queueUrl={URL_PATH} />)
    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument()
  })

  it('shows the student on their own line', async () => {
    render(<GradingQueueApp queueUrl={URL_PATH} />)
    const [firstRow] = await screen.findAllByRole('listitem')
    expect(within(firstRow).getByText('Maya Lopez')).toBeInTheDocument()
  })

  it("filters by course, and only offers that course's units", async () => {
    render(<GradingQueueApp queueUrl={URL_PATH} />)
    await screen.findByText(/waiting on this/)
    expect(screen.getByRole('option', {name: 'Cells'})).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Course'), '2')
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('course_id')).toBe('2'))
    expect(screen.queryByRole('option', {name: 'Cells'})).not.toBeInTheDocument()
    expect(screen.getByRole('option', {name: 'Unit 1'})).toBeInTheDocument()
  })

  it('filters by unit and by student', async () => {
    render(<GradingQueueApp queueUrl={URL_PATH} />)
    await screen.findByText(/waiting on this/)

    await userEvent.selectOptions(screen.getByLabelText('Unit'), '3')
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('unit_id')).toBe('3'))

    await userEvent.selectOptions(screen.getByLabelText('Student'), '5')
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('student_id')).toBe('5'))
  })

  it('sends no filter params while the filters are on "All"', async () => {
    render(<GradingQueueApp queueUrl={URL_PATH} />)
    await screen.findByText(/waiting on this/)
    const params = requests.at(-1)!.searchParams
    expect(params.has('course_id')).toBe(false)
    expect(params.has('unit_id')).toBe(false)
    expect(params.has('student_id')).toBe(false)
  })
})
