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
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import fakeENV from '@canvas/test-utils/fakeENV'
import EducatorTodoListWidget from '../EducatorTodoListWidget'
import type {Widget} from '../../../../types'
import {WidgetLayoutProvider} from '../../../../hooks/useWidgetLayout'
import {WidgetDashboardEditProvider} from '../../../../hooks/useWidgetDashboardEdit'
import {WidgetDashboardProvider} from '../../../../hooks/useWidgetDashboardContext'
import {clearWidgetDashboardCache, PlatformTestWrapper} from '../../../../__tests__/testHelpers'

const widget: Widget = {
  id: 'educator-todo-widget',
  type: 'educator_todo_list',
  position: {col: 2, row: 1, relative: 1},
  title: 'To-do list',
}

const grading = (id: number, name: string, extra = {}) => ({
  type: 'grading',
  assignment: {id, name, due_at: null},
  context_name: 'Algebra 1',
  course_id: 10,
  html_url: `/courses/10/gradebook/speed_grader?assignment_id=${id}`,
  ignore: `/api/v1/users/self/todo/assignment_${id}/grading?permanent=0`,
  needs_grading_count: 3,
  ...extra,
})

const TODOS = [
  grading(1, '1.1 Check', {
    late_needs_grading_count: 2,
    resubmitted_needs_grading_count: 1,
    on_time_needs_grading_count: 4,
    submitted_submissions_count: 7,
    total_submissions_count: 12,
  }),
  grading(2, '1.2 Check'),
  {
    type: 'submitting',
    assignment: {id: 3, name: 'PD reflection', due_at: '2026-09-30T18:00:00Z'},
    context_name: 'Staff PD',
    course_id: 11,
    html_url: '/courses/11/assignments/3#submit',
    ignore: '/api/v1/users/self/todo/assignment_3/submitting?permanent=0',
  },
]

const ignored: string[] = []
const server = setupServer(
  http.get('/api/v1/users/self/todo', () => HttpResponse.json(TODOS)),
  http.delete('/api/v1/users/self/todo/:asset/:type', ({params}) => {
    ignored.push(`${params.asset}/${params.type}`)
    return HttpResponse.json({})
  }),
)

beforeAll(() => server.listen())
beforeEach(() => {
  fakeENV.setup({LOCALE: 'en', TIMEZONE: 'America/Denver'})
  clearWidgetDashboardCache()
  ignored.length = 0
})
afterEach(() => {
  server.resetHandlers()
  fakeENV.teardown()
})
afterAll(() => server.close())

function renderWidget() {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  return render(
    <PlatformTestWrapper>
      <QueryClientProvider client={client}>
        <WidgetDashboardProvider>
          <WidgetDashboardEditProvider>
            <WidgetLayoutProvider>
              <EducatorTodoListWidget widget={widget} />
            </WidgetLayoutProvider>
          </WidgetDashboardEditProvider>
        </WidgetDashboardProvider>
      </QueryClientProvider>
    </PlatformTestWrapper>,
  )
}

describe('EducatorTodoListWidget', () => {
  it("lists the teacher's real to-do items, not sample ones", async () => {
    renderWidget()

    expect(await screen.findByRole('link', {name: '1.1 Check'})).toHaveAttribute(
      'href',
      '/courses/10/gradebook/speed_grader?assignment_id=1',
    )
    expect(screen.getByText('PD reflection')).toBeInTheDocument()
    expect(screen.queryByText(/Problem Set 6/)).not.toBeInTheDocument()
    expect(screen.queryByText(/example pill/)).not.toBeInTheDocument()
  })

  it('breaks down what needs grading and how many have submitted', async () => {
    renderWidget()
    await screen.findByText('1.1 Check')

    expect(screen.getByText('2 late')).toBeInTheDocument()
    expect(screen.getByText('1 resubmitted')).toBeInTheDocument()
    expect(screen.getByText('4 on time')).toBeInTheDocument()
    expect(screen.getByText('7 of 12 students have submitted')).toBeInTheDocument()
    // no breakdown from the server: the plain count
    expect(screen.getByText('3 to grade')).toBeInTheDocument()
  })

  it('opens SpeedGrader from the grading button', async () => {
    renderWidget()

    expect(
      await screen.findByRole('link', {name: 'Grade 1.1 Check in SpeedGrader'}),
    ).toHaveAttribute('href', '/courses/10/gradebook/speed_grader?assignment_id=1')
  })

  it('takes an item off the list', async () => {
    renderWidget()
    await userEvent.click(
      await screen.findByRole('button', {name: 'Remove 1.2 Check from your to-do list'}),
    )

    await waitFor(() => expect(screen.queryByText('1.2 Check')).not.toBeInTheDocument())
    expect(ignored).toEqual(['assignment_2/grading'])
  })

  it('says so when there is nothing to do', async () => {
    server.use(http.get('/api/v1/users/self/todo', () => HttpResponse.json([])))
    renderWidget()

    expect(await screen.findByTestId('educator-todo-empty')).toHaveTextContent(
      'Nothing to grade. You are all caught up.',
    )
  })
})
