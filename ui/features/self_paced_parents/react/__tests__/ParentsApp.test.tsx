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
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import ParentsApp from '../ParentsApp'
import * as flyer from '../flyer'
import type {AdminRequest, Flyer, ParentsConfig} from '../types'

const config: ParentsConfig = {
  flyer_url: '/api/v1/self_paced/parents/flyer',
  reset_url: '/api/v1/self_paced/parents/flyer/reset',
  requests_url: '/api/v1/self_paced/parents/requests',
}

const request = (id: string, extra: Partial<AdminRequest> = {}): AdminRequest => ({
  id,
  status: 'pending',
  note: null,
  response: null,
  created_at: '2026-09-25T15:00:00Z',
  decided_at: null,
  decided_by: null,
  observer: {id: '1', name: 'Pat Kim', email: 'pat@example.com'},
  student: {id: '7', name: 'Maya Lopez', classes: ['Algebra 1'], parents: 0},
  ...extra,
})

const theFlyer: Flyer = {
  school_name: 'Northside High',
  url: 'https://lms.school.example/parents/signup/abc123def456',
  qr_svg: '<svg role="img" aria-label="QR code"><path d="M0 0"/></svg>',
}

let rows: AdminRequest[]
let answers: {id: string; kind: string; body: unknown}[]
let taken: boolean
const server = setupServer(
  http.get(config.flyer_url, () => HttpResponse.json(theFlyer)),
  http.get(config.requests_url, () => HttpResponse.json({requests: rows})),
  http.post(`${config.requests_url}/:id/:kind`, async ({params, request: req}) => {
    const body = (await req.json()) as {response?: string}
    answers.push({id: String(params.id), kind: String(params.kind), body})
    if (taken) {
      return HttpResponse.json(
        {message: 'Someone has already answered this request.'},
        {status: 409},
      )
    }
    const row = rows.find(r => r.id === params.id) as AdminRequest
    const done: AdminRequest = {
      ...row,
      status: params.kind === 'approve' ? 'approved' : 'declined',
      decided_by: 'Ada Admin',
      decided_at: '2026-09-26T12:00:00Z',
      response: body.response || null,
    }
    return HttpResponse.json(done)
  }),
  http.post(config.reset_url, () =>
    HttpResponse.json({...theFlyer, url: 'https://lms.school.example/parents/signup/newcode99999'}),
  ),
)
beforeAll(() => server.listen())
beforeEach(() => {
  rows = [request('1', {note: "I'm her mother"})]
  answers = []
  taken = false
  window.localStorage.clear()
})
afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

describe('ParentsApp requests', () => {
  it('shows who is asking, about whom, and what an admin needs to decide', async () => {
    rows = [
      request('1', {
        note: "I'm her mother",
        student: {id: '7', name: 'Maya Lopez', classes: ['Algebra 1', 'English 9'], parents: 2},
      }),
    ]
    render(<ParentsApp config={config} />)
    const list = await screen.findByRole('list', {name: 'Waiting requests'})

    expect(within(list).getByText('Pat Kim')).toBeInTheDocument()
    expect(within(list).getByText(/pat@example.com/)).toBeInTheDocument()
    expect(within(list).getByText('Maya Lopez')).toBeInTheDocument()
    expect(within(list).getByText('Algebra 1, English 9')).toBeInTheDocument()
    expect(within(list).getByText('Maya Lopez already has 2 parents linked.')).toBeInTheDocument()
    expect(within(list).getByText("I'm her mother")).toBeInTheDocument()
    expect(screen.getByTestId('parents-waiting-count')).toHaveTextContent('1 request is waiting.')
  })

  it('says so when nobody is waiting', async () => {
    rows = []
    render(<ParentsApp config={config} />)

    expect(await screen.findByText('Nobody is waiting for an answer.')).toBeInTheDocument()
  })

  it('asks before approving, and only then links', async () => {
    render(<ParentsApp config={config} />)
    await userEvent.click(
      await screen.findByRole('button', {name: 'Approve Pat Kim for Maya Lopez'}),
    )

    expect(answers).toHaveLength(0)
    expect(
      screen.getByText("Let Pat Kim see Maya Lopez's progress, pace and grades?"),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', {name: 'Yes, approve'}))

    const done = await screen.findByRole('list', {name: 'Answered requests'})
    expect(answers).toEqual([{id: '1', kind: 'approve', body: {}}])
    expect(within(done).getByText('Approved')).toBeInTheDocument()
    expect(within(done).getByText(/by Ada Admin/)).toBeInTheDocument()
    expect(screen.getByTestId('parents-waiting-count')).toHaveTextContent(
      'Nobody is waiting for an answer.',
    )
  })

  it('can back out of an approval without sending anything', async () => {
    render(<ParentsApp config={config} />)
    await userEvent.click(
      await screen.findByRole('button', {name: 'Approve Pat Kim for Maya Lopez'}),
    )
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}))

    expect(answers).toHaveLength(0)
    expect(screen.getByRole('button', {name: 'Approve Pat Kim for Maya Lopez'})).toBeInTheDocument()
  })

  it('declines with a reason the parent will see', async () => {
    render(<ParentsApp config={config} />)
    await userEvent.click(
      await screen.findByRole('button', {name: 'Decline Pat Kim for Maya Lopez'}),
    )
    await userEvent.type(
      screen.getByLabelText('Reason for the parent (optional)'),
      'Please call the front office.',
    )
    await userEvent.click(screen.getByRole('button', {name: 'Decline request'}))

    const done = await screen.findByRole('list', {name: 'Answered requests'})
    expect(answers).toEqual([
      {id: '1', kind: 'decline', body: {response: 'Please call the front office.'}},
    ])
    expect(within(done).getByText('Declined')).toBeInTheDocument()
    expect(within(done).getByText(/Please call the front office\./)).toBeInTheDocument()
  })

  it('says so, and reloads, when someone else answered first', async () => {
    render(<ParentsApp config={config} />)
    await userEvent.click(
      await screen.findByRole('button', {name: 'Approve Pat Kim for Maya Lopez'}),
    )
    taken = true
    rows = [
      request('1', {
        status: 'declined',
        decided_by: 'Bo Admin',
        decided_at: '2026-09-26T11:00:00Z',
      }),
    ]
    await userEvent.click(screen.getByRole('button', {name: 'Yes, approve'}))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Someone has already answered this request.',
    )
    expect(await screen.findByText(/by Bo Admin/)).toBeInTheDocument()
  })
})

describe('ParentsApp flyer', () => {
  it('shows the QR code and the address parents will open', async () => {
    render(<ParentsApp config={config} />)

    const qr = await screen.findByTestId('parent-flyer-qr')
    expect(qr.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('link', {name: theFlyer.url})).toHaveAttribute('href', theFlyer.url)
  })

  it('prints the flyer with the school, the address and the line the school added', async () => {
    const print = vi.spyOn(flyer, 'printHtml').mockImplementation(() => {})
    render(<ParentsApp config={config} />)
    await userEvent.type(
      await screen.findByLabelText('A line for the bottom of the flyer (optional)'),
      'Call 555-0100',
    )
    await userEvent.click(screen.getByRole('button', {name: 'Print flyer'}))

    expect(print).toHaveBeenCalledTimes(1)
    const printed = new DOMParser().parseFromString(print.mock.calls[0][0], 'text/html')
    expect(printed.querySelector('.school')?.textContent).toBe('Northside High')
    expect(printed.querySelector('.url')?.textContent).toBe(theFlyer.url)
    expect(printed.querySelector('.contact')?.textContent).toBe('Call 555-0100')
  })

  it('remembers the line for next time', async () => {
    const {unmount} = render(<ParentsApp config={config} />)
    await userEvent.type(
      await screen.findByLabelText('A line for the bottom of the flyer (optional)'),
      'Front office',
    )
    unmount()
    render(<ParentsApp config={config} />)

    expect(
      await screen.findByLabelText('A line for the bottom of the flyer (optional)'),
    ).toHaveValue('Front office')
  })

  it('asks before making a new code, then shows the new address', async () => {
    render(<ParentsApp config={config} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Make a new code'}))

    expect(screen.getByText(/stops every flyer already handed out/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Yes, make a new code'}))

    expect(
      await screen.findByRole('link', {name: /parents\/signup\/newcode99999/}),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('the old ones no longer work')
  })
})
