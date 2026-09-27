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
import AccommodationsCard, {type AccommodationCardData} from '../AccommodationsCard'

const server = setupServer()
const URL = '/api/v1/supports/students/7/accommodations'

const card = (overrides: Partial<AccommodationCardData> = {}): AccommodationCardData => ({
  student: {id: '7', name: 'Pat Student'},
  accommodations: [
    {
      id: 1,
      name: 'Extended time on tests and quizzes',
      kind: 'extended_time',
      details: '1.5x time on timed quizzes',
      instructions: null,
      teacher_note: 'Quiet room if possible',
      courses: null,
      start_date: null,
      end_date: null,
    },
  ],
  acknowledged: false,
  can_manage: false,
  ...overrides,
})

describe('AccommodationsCard', () => {
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it("lists the student's accommodations", async () => {
    server.use(http.get(URL, () => HttpResponse.json(card())))
    render(<AccommodationsCard studentId="7" />)
    expect(await screen.findByText('1.5x time on timed quizzes')).toBeInTheDocument()
    expect(screen.getByText('Quiet room if possible')).toBeInTheDocument()
    expect(screen.getByText('In all classes')).toBeInTheDocument()
  })

  it('shows nothing when the viewer may not see them', async () => {
    let asked = false
    server.use(
      http.get(URL, () => {
        asked = true
        return HttpResponse.json({status: 'unauthorized'}, {status: 401})
      }),
    )
    const {container} = render(<AccommodationsCard studentId="7" />)
    await waitFor(() => expect(asked).toBe(true))
    expect(container).toBeEmptyDOMElement()
  })

  it('records that the teacher read the list', async () => {
    server.use(
      http.get(URL, () => HttpResponse.json(card())),
      http.post('/api/v1/supports/students/7/acknowledgement', () =>
        HttpResponse.json(card({acknowledged: true})),
      ),
    )
    render(<AccommodationsCard studentId="7" />)
    await userEvent.click(
      await screen.findByRole('button', {name: 'I have read these accommodations'}),
    )
    expect(await screen.findByText('You have read this list.')).toBeInTheDocument()
  })

  it('never names the kind of plan', async () => {
    server.use(http.get(URL, () => HttpResponse.json(card())))
    const {container} = render(<AccommodationsCard studentId="7" />)
    await screen.findByText('1.5x time on timed quizzes')
    expect(container.textContent).not.toMatch(/IEP|504/)
  })
})
