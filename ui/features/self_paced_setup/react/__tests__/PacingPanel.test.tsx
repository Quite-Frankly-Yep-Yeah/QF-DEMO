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
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import PacingPanel, {type PacingCalendar} from '../PacingPanel'

const URL = '/api/v1/courses/1/self_paced/calendar'
const server = setupServer()

function calendar(overrides: Partial<PacingCalendar> = {}): PacingCalendar {
  return {
    account: {id: '3', name: 'Lincoln High'},
    weekday_minutes: [0, 360, 360, 360, 360, 360, 0],
    date_minutes: {},
    can_edit_calendar: false,
    target_date: '2027-06-04',
    course_end_date: null,
    blackout_dates: [
      {
        id: '5',
        title: 'Fall break',
        start_date: '2026-10-19',
        end_date: '2026-10-20',
        source: 'course',
      },
      {
        id: null,
        title: 'District PD day',
        start_date: '2026-11-06',
        end_date: '2026-11-06',
        source: 'account',
      },
    ],
    blackout_dates_url: '/api/v1/courses/1/blackout_dates',
    ...overrides,
  }
}

describe('PacingPanel', () => {
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('shows the finish date, school days and days off', async () => {
    server.use(http.get(URL, () => HttpResponse.json(calendar())))
    render(<PacingPanel url={URL} />)

    expect(await screen.findByLabelText('Finish date')).toHaveValue('2027-06-04')
    expect(screen.getByText('Fall break')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Remove Fall break'})).toBeInTheDocument()
    expect(screen.getByText('Set by the school')).toBeInTheDocument() // the district day can't be removed here
  })

  it("keeps the school's week read-only for teachers, and doesn't send it", async () => {
    let sent: Record<string, unknown> | null = null
    server.use(
      http.get(URL, () => HttpResponse.json(calendar())),
      http.put(URL, async ({request}) => {
        sent = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(calendar({target_date: '2027-05-28'}))
      }),
    )
    render(<PacingPanel url={URL} />)

    fireEvent.change(await screen.findByLabelText('Finish date'), {target: {value: '2027-05-28'}})
    expect(screen.getByLabelText(/Minutes on Monday/)).toHaveAttribute('readonly')
    await userEvent.click(screen.getByRole('button', {name: 'Save pacing'}))

    await waitFor(() => expect(sent).toEqual({target_date: '2027-05-28'}))
  })

  it('lets admins change the minutes for each weekday', async () => {
    let sent: Record<string, unknown> | null = null
    server.use(
      http.get(URL, () => HttpResponse.json(calendar({can_edit_calendar: true}))),
      http.put(URL, async ({request}) => {
        sent = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(calendar({can_edit_calendar: true}))
      }),
    )
    render(<PacingPanel url={URL} />)

    const friday = await screen.findByLabelText(/Minutes on Friday/)
    await userEvent.clear(friday)
    await userEvent.type(friday, '180')
    await userEvent.click(screen.getByRole('button', {name: 'Save pacing'}))

    await waitFor(() =>
      expect(sent).toMatchObject({weekday_minutes: [0, 360, 360, 360, 360, 180, 0]}),
    )
  })

  it('adds a day off through the blackout dates API', async () => {
    let posted: unknown = null
    server.use(
      http.get(URL, () => HttpResponse.json(calendar())),
      http.post('/api/v1/courses/1/blackout_dates', async ({request}) => {
        posted = await request.json()
        return HttpResponse.json({}, {status: 201})
      }),
    )
    render(<PacingPanel url={URL} />)

    await userEvent.type(await screen.findByLabelText('Name'), 'Thanksgiving')
    fireEvent.change(screen.getByLabelText('From'), {target: {value: '2026-11-26'}})
    await userEvent.click(screen.getByRole('button', {name: 'Add day off'}))

    await waitFor(() =>
      expect(posted).toEqual({
        blackout_date: {
          event_title: 'Thanksgiving',
          start_date: '2026-11-26',
          end_date: '2026-11-26',
        },
      }),
    )
  })
})
