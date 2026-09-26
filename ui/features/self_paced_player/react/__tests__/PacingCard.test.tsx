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
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import PacingCard from '../PacingCard'
import {pacingFixture} from '@canvas/self-paced/__tests__/pacingFixtures'
import type {Pacing} from '@canvas/self-paced/pacing'

const URL = '/api/v1/courses/1/self_paced/pacing'
const server = setupServer()

function respondWith(pacing: Pacing | null, status = 200) {
  server.use(http.get(URL, () => HttpResponse.json(pacing ?? {message: 'nope'}, {status})))
}

describe('PacingCard', () => {
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it("shows the student's pace and finish date", async () => {
    respondWith(pacingFixture())
    render(<PacingCard url={URL} color="#2a78d6" />)

    expect(await screen.findByRole('heading', {name: /1 day ahead/})).toBeInTheDocument()
    expect(screen.getByText(/Finish by .*2026.*24 min a school day/)).toBeInTheDocument()
  })

  it("lists today's work and the rest of the week", async () => {
    respondWith(pacingFixture())
    render(<PacingCard url={URL} color="#2a78d6" />)

    const today = await screen.findByRole('region', {name: 'Today'})
    expect(within(today).getByText('0 of 1 done, about 30 min')).toBeInTheDocument()
    expect(within(today).getByRole('link', {name: 'Lesson 3'})).toHaveAttribute(
      'href',
      '/courses/1/modules/items/3',
    )

    const week = screen.getByRole('region', {name: 'This week'})
    expect(within(week).getByText('1 of 3 done')).toBeInTheDocument()
    expect(within(week).getByRole('link', {name: 'Lesson 4'})).toBeInTheDocument()
  })

  it('flags work left over from an earlier day', async () => {
    const pacing = pacingFixture()
    pacing.items[0].completed = false
    respondWith(pacing)
    render(<PacingCard url={URL} color="#2a78d6" />)

    expect(await screen.findByText(/^from /)).toBeInTheDocument()
  })

  it('cheers when the day is done', async () => {
    respondWith(pacingFixture({today: {total: 1, done: 1, minutes: 30, item_ids: ['3']}}))
    render(<PacingCard url={URL} color="#2a78d6" />)

    expect(await screen.findByText('Done for today. Keep going to get ahead.')).toBeInTheDocument()
  })

  it('says so when the course is finished', async () => {
    respondWith(pacingFixture({finished: true, days_ahead: 0}))
    render(<PacingCard url={URL} color="#2a78d6" />)

    expect(
      await screen.findByText("You've finished all the work in this course."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: 'Today'})).not.toBeInTheDocument()
  })

  it("explains when the plan doesn't load", async () => {
    respondWith(null, 500)
    render(<PacingCard url={URL} color="#2a78d6" />)

    expect(
      await screen.findByText("Your plan didn't load. Reload the page to try again."),
    ).toBeInTheDocument()
  })
})
