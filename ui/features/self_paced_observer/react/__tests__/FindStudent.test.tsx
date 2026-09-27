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
import FindStudent, {nameParts, RequestList, specificEnough} from '../FindStudent'
import type {LinkRequest, StudentSearch} from '../types'

const SEARCH = '/api/v1/self_paced/observer/students'
const REQUESTS = '/api/v1/self_paced/observer/link_requests'

const asked = (id: string, extra: Partial<LinkRequest> = {}): LinkRequest => ({
  id,
  status: 'pending',
  student: {id: '7', name: 'Maya Lopez'},
  note: null,
  response: null,
  created_at: '2026-09-25T15:00:00Z',
  decided_at: null,
  ...extra,
})

let searches: string[]
let result: StudentSearch
let posted: unknown[]
let refusal: string | null
let cancelled: string[]
const server = setupServer(
  http.get(SEARCH, ({request}) => {
    searches.push(new URL(request.url).searchParams.get('q') ?? '')
    return HttpResponse.json(result)
  }),
  http.post(REQUESTS, async ({request}) => {
    posted.push(await request.json())
    if (refusal) return HttpResponse.json({message: refusal}, {status: 422})
    return HttpResponse.json(asked('9', {note: 'her mom'}), {status: 201})
  }),
  http.delete(`${REQUESTS}/:id`, ({params}) => {
    cancelled.push(String(params.id))
    return HttpResponse.json(asked(String(params.id), {status: 'cancelled'}))
  }),
)
beforeAll(() => server.listen())
beforeEach(() => {
  searches = []
  posted = []
  cancelled = []
  refusal = null
  result = {students: [{id: '7', name: 'Maya Lopez'}], too_many: false}
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderFinder(requests: LinkRequest[] = []) {
  const onRequested = vi.fn()
  const onCancelled = vi.fn()
  render(
    <FindStudent
      searchUrl={SEARCH}
      requestsUrl={REQUESTS}
      requests={requests}
      onRequested={onRequested}
      onCancelled={onCancelled}
    />,
  )
  return {onRequested, onCancelled}
}

const type = (text: string) => userEvent.type(screen.getByLabelText("Your student's name"), text)

describe('name rules', () => {
  it('want two parts of a name, each at least two letters', () => {
    expect(nameParts("  Maya  O'Neil-Lopez ")).toEqual(['maya', "o'neil-lopez"])
    expect(specificEnough('maya')).toBe(false)
    expect(specificEnough('m lopez')).toBe(false)
    expect(specificEnough('maya lopez')).toBe(true)
    expect(specificEnough('a b c d e')).toBe(false)
  })
})

describe('FindStudent', () => {
  it("says what to type, and doesn't ask the school until it is specific enough", async () => {
    renderFinder()
    expect(screen.getByText("Type your student's first and last name.")).toBeInTheDocument()

    await type('maya')
    expect(screen.getByText('Add their last name too.')).toBeInTheDocument()

    await new Promise(resolve => setTimeout(resolve, 500))
    expect(searches).toEqual([])
  })

  it('looks a moment after they stop typing, and offers the matches to pick from', async () => {
    renderFinder()
    await type('maya lopez')

    const match = await screen.findByRole('radio', {name: 'Maya Lopez'})
    // one search for what they typed, not one per key
    expect(searches).toEqual(['maya lopez'])
    expect(match).not.toBeChecked()
  })

  it('asks for more of the name when too many students match', async () => {
    result = {students: [], too_many: true}
    renderFinder()
    await type('ma lo')

    expect(
      await screen.findByText('That matches a lot of students. Type more of the name.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('says so when nobody matches', async () => {
    result = {students: [], too_many: false}
    renderFinder()
    await type('zed zzz')

    expect(await screen.findByText(/No student matches that name/)).toBeInTheDocument()
  })

  it("won't offer to ask until they've picked a student", async () => {
    renderFinder()
    await type('maya lopez')
    await screen.findByRole('radio', {name: 'Maya Lopez'})

    expect(screen.queryByRole('button', {name: 'Ask the school to link us'})).toBeNull()
  })

  it('asks the school to link them, with a note, and says it went', async () => {
    const {onRequested} = renderFinder()
    await type('maya lopez')
    await userEvent.click(await screen.findByRole('radio', {name: 'Maya Lopez'}))
    await userEvent.type(screen.getByLabelText(/Anything the school should know/), 'her mom')
    await userEvent.click(screen.getByRole('button', {name: 'Ask the school to link us'}))

    expect(
      await screen.findByText(/Sent\. The school will look at your request for Maya Lopez\./),
    ).toBeInTheDocument()
    expect(posted).toEqual([{student_id: '7', note: 'her mom'}])
    expect(onRequested).toHaveBeenCalledWith(expect.objectContaining({id: '9', status: 'pending'}))
    expect(screen.getByLabelText("Your student's name")).toHaveValue('')
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it("tells them the school checks, so they don't expect to see anything yet", async () => {
    renderFinder()
    await type('maya lopez')
    await userEvent.click(await screen.findByRole('radio', {name: 'Maya Lopez'}))

    expect(
      screen.getByText("The school checks that you're Maya's parent before you can see anything."),
    ).toBeInTheDocument()
  })

  it('shows why the school refused, and lets them try again', async () => {
    refusal = "You've already asked to follow Maya Lopez."
    const {onRequested} = renderFinder()
    await type('maya lopez')
    await userEvent.click(await screen.findByRole('radio', {name: 'Maya Lopez'}))
    await userEvent.click(screen.getByRole('button', {name: 'Ask the school to link us'}))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "You've already asked to follow Maya Lopez.",
    )
    expect(onRequested).not.toHaveBeenCalled()
    expect(screen.getByRole('button', {name: 'Ask the school to link us'})).toBeEnabled()
  })

  it('can take back a request that is still waiting', async () => {
    const {onCancelled} = renderFinder([asked('4')])
    await userEvent.click(screen.getByRole('button', {name: 'Cancel the request for Maya Lopez'}))

    await vi.waitFor(() => expect(onCancelled).toHaveBeenCalledWith('4'))
    expect(cancelled).toEqual(['4'])
  })
})

describe('RequestList', () => {
  const noop = () => {}

  it('shows each request with where it stands', () => {
    render(
      <RequestList
        busyId={null}
        onCancel={noop}
        requests={[
          asked('1'),
          asked('2', {status: 'approved', student: {id: '8', name: 'Jordan Kim'}}),
          asked('3', {
            status: 'declined',
            student: {id: '9', name: 'Sam Doe'},
            response: 'Please call the office.',
          }),
        ]}
      />,
    )

    expect(screen.getByText('Waiting for the school')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText(/Reload this page to see how Jordan Kim is doing/)).toBeInTheDocument()
    expect(screen.getByText('Not approved')).toBeInTheDocument()
    expect(screen.getByText('Please call the office.')).toBeInTheDocument()
  })

  it('only lets them cancel one that is waiting', () => {
    render(
      <RequestList
        busyId={null}
        onCancel={noop}
        requests={[asked('1'), asked('2', {status: 'approved'}), asked('3', {status: 'declined'})]}
      />,
    )

    expect(screen.getAllByRole('button', {name: /Cancel the request/})).toHaveLength(1)
  })

  it('says something kind when the school gave no reason', () => {
    render(
      <RequestList busyId={null} onCancel={noop} requests={[asked('3', {status: 'declined'})]} />,
    )

    expect(screen.getByText(/The school didn't approve this request/)).toBeInTheDocument()
  })

  it('draws nothing for no requests', () => {
    const {container} = render(<RequestList busyId={null} onCancel={noop} requests={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
