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
import PersonPicker from '../PersonPicker'

const server = setupServer(
  http.get('/api/v1/supports/students', () =>
    HttpResponse.json({
      students: [
        {id: '1', name: 'Sam Same', sis_user_id: '111111'},
        {id: '2', name: 'Sam Same', sis_user_id: '222222'},
        {id: '3', name: 'Sam Different', sis_user_id: null},
      ],
    }),
  ),
)

describe('PersonPicker', () => {
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('shows the SIS ID beside a name so two people with the same name can be told apart', async () => {
    render(
      <PersonPicker
        label="Student"
        url="/api/v1/supports/students"
        resultKey="students"
        selected={null}
        onSelect={vi.fn()}
      />,
    )
    await userEvent.type(screen.getByLabelText('Student'), 'Sam')
    expect(await screen.findByRole('button', {name: /Sam Same.*111111/})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: /Sam Same.*222222/})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Sam Different'})).toBeInTheDocument()
  })

  it('hands back the person that was picked', async () => {
    const onSelect = vi.fn()
    render(
      <PersonPicker
        label="Student"
        url="/api/v1/supports/students"
        resultKey="students"
        selected={null}
        onSelect={onSelect}
      />,
    )
    await userEvent.type(screen.getByLabelText('Student'), '2222')
    await userEvent.click(await screen.findByRole('button', {name: /222222/}))
    expect(onSelect).toHaveBeenCalledWith({id: '2', name: 'Sam Same', sis_user_id: '222222'})
  })

  it('shows who is selected, with the SIS ID when there is one', () => {
    render(
      <PersonPicker
        label="Student"
        url="/api/v1/supports/students"
        resultKey="students"
        selected={{id: '1', name: 'Sam Same', sis_user_id: '111111'}}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText(/Sam Same/)).toHaveTextContent('111111')
  })
})
