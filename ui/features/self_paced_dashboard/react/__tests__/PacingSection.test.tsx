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
import PacingSection from '../PacingSection'
import {pacingFixture} from '@canvas/self-paced/__tests__/pacingFixtures'
import type {Pacing} from '@canvas/self-paced/pacing'

const PACING_URL = '/api/v1/courses/:course_id/self_paced/pacing?student_id=:student_id'
const STUDENT_PACING_URL = '/api/v1/courses/:course_id/self_paced/pacing/:student_id'
const server = setupServer()

function renderSection(onChanged = vi.fn()) {
  render(
    <PacingSection
      courseId="4"
      studentId="7"
      pacingUrl={PACING_URL}
      studentPacingUrl={STUDENT_PACING_URL}
      color="#2a78d6"
      onChanged={onChanged}
    />,
  )
  return onChanged
}

function respondWith(pacing: Pacing | null, status = 200) {
  server.use(
    http.get('/api/v1/courses/4/self_paced/pacing', () =>
      HttpResponse.json(pacing ?? {message: 'not a student in this course'}, {status}),
    ),
  )
}

describe('PacingSection', () => {
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it("shows the student's pace against the plan", async () => {
    respondWith(pacingFixture())
    renderSection()

    expect(await screen.findByText('1 day ahead')).toBeInTheDocument()
    expect(screen.getByText('50% done, 40% planned by now')).toBeInTheDocument()
    expect(screen.getByText(/the course's date/)).toBeInTheDocument()
  })

  it('stays out of the way for courses without pacing', async () => {
    respondWith(null, 404)
    const {container} = render(
      <PacingSection
        courseId="4"
        studentId="7"
        pacingUrl={PACING_URL}
        studentPacingUrl={STUDENT_PACING_URL}
        color="#2a78d6"
        onChanged={vi.fn()}
      />,
    )

    await new Promise(resolve => setTimeout(resolve, 50))
    expect(container).toBeEmptyDOMElement()
  })

  it('only offers the target date to staff who can change it', async () => {
    respondWith(pacingFixture({can_adjust: false}))
    renderSection()

    await screen.findByText('1 day ahead')
    expect(screen.queryByLabelText('Target date')).not.toBeInTheDocument()
  })

  it("saves the student's own target date", async () => {
    respondWith(pacingFixture({can_adjust: true}))
    let sent: unknown = null
    server.use(
      http.put('/api/v1/courses/4/self_paced/pacing/7', async ({request}) => {
        sent = await request.json()
        return HttpResponse.json(
          pacingFixture({can_adjust: true, target_date: '2026-10-16', target_source: 'teacher'}),
        )
      }),
    )
    const onChanged = renderSection()

    const input = await screen.findByLabelText('Target date')
    fireEvent.change(input, {target: {value: '2026-10-16'}})
    await userEvent.click(screen.getByRole('button', {name: 'Save date'}))

    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(sent).toEqual({target_date: '2026-10-16'})
    expect(screen.getByText(/a date set for this student/)).toBeInTheDocument()
    expect(screen.getByRole('button', {name: "Use the course's date"})).toBeInTheDocument()
  })
})
