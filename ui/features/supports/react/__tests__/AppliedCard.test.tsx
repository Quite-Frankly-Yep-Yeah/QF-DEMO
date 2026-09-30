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
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import AppliedCard, {type Applied} from '../AppliedCard'

const server = setupServer()
const URL = '/api/v1/supports/students/7/applications'

const row = (overrides: Partial<Applied>): Applied => ({
  id: '1',
  kind: 'extended_time',
  accommodation: 'Extended time on tests and quizzes',
  course: {id: '3', name: 'Algebra 1'},
  quiz_title: 'Unit 1 Quiz',
  details: {minutes: 15, attempt: 1},
  created_at: '2026-09-28T14:00:00Z',
  ...overrides,
})

describe('AppliedCard', () => {
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('says what was applied, where', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({
          days: 7,
          applications: [
            row({}),
            row({
              id: '2',
              kind: 'pacing',
              quiz_title: null,
              details: {mode: 'extend_finish', percent: 25, target_date: '2027-06-18'},
            }),
          ],
        }),
      ),
    )
    render(<AppliedCard studentId="7" />)
    expect(
      await screen.findByText('15 extra minutes on Unit 1 Quiz, attempt 1'),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Finish date moved to/)).toBeInTheDocument()
  })

  it('says when nothing was applied', async () => {
    server.use(http.get(URL, () => HttpResponse.json({days: 7, applications: []})))
    render(<AppliedCard studentId="7" />)
    expect(await screen.findByText('Nothing was applied in the last 7 days.')).toBeInTheDocument()
  })

  it('shows nothing when the viewer may not see it', async () => {
    let asked = false
    server.use(
      http.get(URL, () => {
        asked = true
        return HttpResponse.json({status: 'unauthorized'}, {status: 401})
      }),
    )
    const {container} = render(<AppliedCard studentId="7" />)
    await waitFor(() => expect(asked).toBe(true))
    expect(container).toBeEmptyDOMElement()
  })
})
