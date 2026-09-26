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
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import fakeENV from '@canvas/test-utils/fakeENV'
import StudentsNeedYouWidget from '../StudentsNeedYouWidget'
import ClassProgressWidget from '../ClassProgressWidget'
import EducatorAlertsWidget from '../EducatorAlertsWidget'
import type {Widget} from '../../../../types'
import {WidgetLayoutProvider} from '../../../../hooks/useWidgetLayout'
import {WidgetDashboardEditProvider} from '../../../../hooks/useWidgetDashboardEdit'
import {WidgetDashboardProvider} from '../../../../hooks/useWidgetDashboardContext'
import {clearWidgetDashboardCache, PlatformTestWrapper} from '../../../../__tests__/testHelpers'

const widget: Widget = {
  id: 'w',
  type: 'educator_students_need_you',
  position: {col: 2, row: 1, relative: 1},
  title: 'Widget',
}

const recent = new Date().toISOString()
const row = (id: string, name: string, extra = {}) => ({
  student: {id, name},
  course: {id: '10', name: 'Algebra 1'},
  percent_complete: 40,
  attempts_on_current_item: 0,
  days_behind: 0,
  last_active_at: recent,
  ...extra,
})

const ROWS = [
  row('1', 'Maya Lopez'),
  row('2', 'Jordan Kim', {attempts_on_current_item: 4, days_behind: 5}),
  row('3', 'Sam Rivera', {last_active_at: null}),
]

const server = setupServer(
  http.get('/api/v1/self_paced/roster', () => HttpResponse.json({rows: ROWS})),
)
beforeAll(() => server.listen())
beforeEach(() => {
  fakeENV.setup({LOCALE: 'en', TIMEZONE: 'America/Denver'})
  clearWidgetDashboardCache()
})
afterEach(() => {
  server.resetHandlers()
  fakeENV.teardown()
})
afterAll(() => server.close())

function renderWidget(ui: React.ReactElement) {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  return render(
    <PlatformTestWrapper>
      <QueryClientProvider client={client}>
        <WidgetDashboardProvider>
          <WidgetDashboardEditProvider>
            <WidgetLayoutProvider>{ui}</WidgetLayoutProvider>
          </WidgetDashboardEditProvider>
        </WidgetDashboardProvider>
      </QueryClientProvider>
    </PlatformTestWrapper>,
  )
}

describe('StudentsNeedYouWidget', () => {
  it('lists only students who are stuck, behind or inactive, most reasons first', async () => {
    renderWidget(<StudentsNeedYouWidget widget={widget} />)

    const jordan = await screen.findByRole('link', {name: 'Jordan Kim'})
    expect(jordan).toHaveAttribute('href', '/self_paced/dashboard?course_id=10&student_id=2')
    expect(screen.getByText('Stuck')).toBeInTheDocument()
    expect(screen.getByText('Behind pace')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Sam Rivera'})).toBeInTheDocument()
    expect(screen.queryByText('Maya Lopez')).not.toBeInTheDocument()
  })

  it('says so when everyone is fine', async () => {
    server.use(
      http.get('/api/v1/self_paced/roster', () =>
        HttpResponse.json({rows: [row('1', 'Maya Lopez')]}),
      ),
    )
    renderWidget(<StudentsNeedYouWidget widget={widget} />)

    expect(await screen.findByTestId('students-need-you-empty')).toBeInTheDocument()
  })
})

describe('ClassProgressWidget', () => {
  it('shows each class with its average progress and who needs attention', async () => {
    renderWidget(<ClassProgressWidget widget={widget} />)

    expect(await screen.findByRole('link', {name: 'Algebra 1'})).toHaveAttribute(
      'href',
      '/self_paced/dashboard?course_id=10',
    )
    expect(screen.getByRole('meter', {name: 'Average progress in Algebra 1'})).toHaveAttribute(
      'aria-valuenow',
      '40',
    )
    expect(
      screen.getByText(/40% done on average, 3 students · 2 need attention/),
    ).toBeInTheDocument()
  })
})

describe('EducatorAlertsWidget', () => {
  const alert = {
    id: '7',
    kind: 'behind',
    description: '4 days behind their pace',
    student: {id: '2', name: 'Jordan Kim'},
    course: {id: '10', name: 'Algebra 1'},
  }

  it('lists open alerts and dismisses one', async () => {
    let dismissed = ''
    server.use(
      http.get('/api/v1/self_paced/alerts', () =>
        HttpResponse.json({alerts: dismissed ? [] : [alert]}),
      ),
      http.put('/api/v1/self_paced/alerts/:id/dismiss', ({params}) => {
        dismissed = String(params.id)
        return HttpResponse.json({id: dismissed})
      }),
    )
    renderWidget(<EducatorAlertsWidget widget={widget} />)

    expect(await screen.findByRole('link', {name: 'Jordan Kim'})).toHaveAttribute(
      'href',
      '/self_paced/dashboard?course_id=10&student_id=2',
    )
    expect(screen.getByText('4 days behind their pace')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss the alert for Jordan Kim'}))

    expect(await screen.findByTestId('educator-alerts-empty')).toBeInTheDocument()
    expect(dismissed).toBe('7')
  })
})
