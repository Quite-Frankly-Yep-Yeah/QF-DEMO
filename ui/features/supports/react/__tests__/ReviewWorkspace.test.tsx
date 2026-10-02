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

import React, {useState} from 'react'
import {render, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import ReviewWorkspace from '../ReviewWorkspace'
import type {ScanRecord} from '../types'
import {scanRecord} from './fixtures'

const scanFor = (id: number, student: string, overrides: Partial<ScanRecord> = {}) =>
  scanRecord({
    id,
    filename: `${student.toLowerCase().replace(' ', '-')}.pdf`,
    student: {id: String(id), name: student},
    batch_id: 1,
    ...overrides,
  })

const three = () => [scanFor(5, 'Pat Student'), scanFor(6, 'Riley Other'), scanFor(7, 'Sam Third')]

const requests: {method: string; path: string; body?: unknown}[] = []
let remote: ScanRecord[] = []

const note = async (request: Request) => {
  const text = await request.text()
  requests.push({
    method: request.method,
    path: new URL(request.url).pathname,
    body: text.startsWith('{') ? JSON.parse(text) : undefined,
  })
}
const find = (id: string | readonly string[]) => remote.find(r => String(r.id) === id)!

const server = setupServer(
  http.put('/api/v1/supports/imports/:id/review', async ({params, request}) => {
    await note(request)
    return HttpResponse.json(find(params.id as string))
  }),
  http.post('/api/v1/supports/imports/:id/apply', async ({params, request}) => {
    await note(request)
    return HttpResponse.json({...find(params.id as string), workflow_state: 'applied', plan_id: 9})
  }),
  http.post('/api/v1/supports/imports/:id/undo', async ({params, request}) => {
    await note(request)
    return HttpResponse.json({...find(params.id as string), workflow_state: 'undone'})
  }),
  http.delete('/api/v1/supports/imports/:id', async ({params, request}) => {
    await note(request)
    return HttpResponse.json({...find(params.id as string), workflow_state: 'discarded'})
  }),
)

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  requests.length = 0
  delete (window as {matchMedia?: unknown}).matchMedia
})
afterAll(() => server.close())

const narrowScreen = (narrow: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: narrow && query.includes('max-width'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

function Harness({
  initial,
  startAt = initial[0]?.id ?? 0,
  single,
  onBack = vi.fn(),
}: {
  initial: ScanRecord[]
  startAt?: number
  single?: boolean
  onBack?: (message?: string) => void
}) {
  const [records, setRecords] = useState(initial)
  const [currentId, setCurrentId] = useState(startAt)
  return (
    <ReviewWorkspace
      records={records}
      currentId={currentId}
      accountId="1"
      single={single}
      onSelect={setCurrentId}
      onChange={next => {
        remote = remote.map(r => (r.id === next.id ? next : r))
        setRecords(list => list.map(r => (r.id === next.id ? next : r)))
      }}
      onBack={onBack}
    />
  )
}

const mount = (
  records: ScanRecord[],
  props: Partial<React.ComponentProps<typeof Harness>> = {},
) => {
  remote = records
  return render(<Harness initial={records} {...props} />)
}

describe('ReviewWorkspace layout', () => {
  it('has a left column with the queue and summary, and cards and notes on the right', () => {
    narrowScreen(false)
    mount(three())
    expect(screen.getByTestId('review-layout').style.gridTemplateColumns).toBe(
      'minmax(16rem, 20rem) minmax(0, 1fr)',
    )
    const queue = screen.getByRole('list', {name: 'Scans in this batch'})
    expect(within(queue).getAllByRole('listitem')).toHaveLength(3)
    expect(within(queue).getByText('Riley Other')).toBeInTheDocument()
    expect(within(queue).getAllByText('To review')).toHaveLength(3)
    const current = within(queue).getByRole('button', {name: /Pat Student/})
    expect(current).toHaveAttribute('aria-current', 'true')
    expect(within(queue).getByRole('button', {name: /Sam Third/})).not.toHaveAttribute(
      'aria-current',
    )
    expect(screen.getByRole('heading', {name: 'Summary'})).toBeInTheDocument()
    expect(screen.getByLabelText('Plan type')).toHaveValue('iep')
    expect(
      screen.getByRole('heading', {name: 'Extended time on tests and quizzes'}),
    ).toBeInTheDocument()
    expect(screen.getByText(/Speech therapy 30 min weekly/)).toBeInTheDocument()
  })

  it('shows each scan with its status', async () => {
    narrowScreen(false)
    mount([
      scanFor(5, 'Pat Student'),
      scanFor(6, 'Riley Other', {workflow_state: 'applied'}),
      scanFor(7, 'Sam Third', {workflow_state: 'discarded'}),
    ])
    const queue = screen.getByRole('list', {name: 'Scans in this batch'})
    expect(within(queue).getByRole('button', {name: /Riley Other.*Applied/})).toBeInTheDocument()
    expect(within(queue).getByRole('button', {name: /Sam Third.*Skipped/})).toBeInTheDocument()
  })

  it('has no queue for a single scan', () => {
    narrowScreen(false)
    mount([scanFor(5, 'Pat Student')])
    expect(screen.queryByRole('list', {name: 'Scans in this batch'})).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Apply'})).toBeInTheDocument()
    expect(screen.getByText('Scan for Pat Student')).toBeInTheDocument()
  })

  it('turns the queue into a "3 of 12" stepper on a narrow screen', async () => {
    narrowScreen(true)
    mount(
      Array.from({length: 12}, (_, i) => scanFor(i + 1, `Student ${i + 1}`)),
      {startAt: 3},
    )
    expect(screen.getByText('3 of 12')).toBeInTheDocument()
    expect(screen.queryByRole('list', {name: 'Scans in this batch'})).not.toBeInTheDocument()
    expect(screen.getByTestId('review-layout').style.gridTemplateColumns).toBe('minmax(0, 1fr)')
    await userEvent.click(screen.getByRole('button', {name: 'Next scan'}))
    expect(screen.getByText('4 of 12')).toBeInTheDocument()
    expect(screen.getByText('Scan for Student 4')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('4 of 12')
  })
})

describe('ReviewWorkspace sticky bar', () => {
  it('applies the scan, moves to the next one to review, focuses its heading and announces it', async () => {
    narrowScreen(false)
    mount(three())
    await userEvent.click(screen.getByRole('button', {name: 'Apply & next'}))
    await waitFor(() => expect(requests.some(r => r.path.endsWith('/5/apply'))).toBe(true))
    const heading = await screen.findByRole('heading', {name: 'Scan for Riley Other'})
    await waitFor(() => expect(heading).toHaveFocus())
    expect(screen.getByRole('status')).toHaveTextContent(
      /Applied\. Now reviewing Riley Other, 2 of 3/,
    )
    expect(
      within(screen.getByRole('list', {name: 'Scans in this batch'})).getByRole('button', {
        name: /Pat Student.*Applied/,
      }),
    ).toBeInTheDocument()
  })

  it('skips ahead past scans that are already done', async () => {
    narrowScreen(false)
    mount([
      scanFor(5, 'Pat Student'),
      scanFor(6, 'Riley Other', {workflow_state: 'applied'}),
      scanFor(7, 'Sam Third'),
    ])
    await userEvent.click(screen.getByRole('button', {name: 'Apply & next'}))
    expect(await screen.findByRole('heading', {name: 'Scan for Sam Third'})).toBeInTheDocument()
  })

  it('says it was the last scan and returns to the table', async () => {
    narrowScreen(false)
    const onBack = vi.fn()
    mount([scanFor(5, 'Pat Student'), scanFor(6, 'Riley Other', {workflow_state: 'applied'})], {
      onBack,
    })
    await userEvent.click(screen.getByRole('button', {name: 'Apply & next'}))
    await waitFor(() => expect(onBack).toHaveBeenCalled())
    expect(onBack.mock.calls[0][0]).toMatch(/Applied\. That was the last scan to review/)
  })

  it('skips by deleting the scan and moves on', async () => {
    narrowScreen(false)
    mount(three())
    await userEvent.click(screen.getByRole('button', {name: 'Skip'}))
    await waitFor(() =>
      expect(requests).toContainEqual(
        expect.objectContaining({method: 'DELETE', path: '/api/v1/supports/imports/5'}),
      ),
    )
    expect(await screen.findByRole('heading', {name: 'Scan for Riley Other'})).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Skipped\./)
    expect(
      within(screen.getByRole('list', {name: 'Scans in this batch'})).getByRole('button', {
        name: /Pat Student.*Skipped/,
      }),
    ).toBeInTheDocument()
  })

  it('goes back to the matches', async () => {
    narrowScreen(false)
    const onBack = vi.fn()
    mount(three(), {onBack})
    await userEvent.click(screen.getByRole('button', {name: 'Back to matches'}))
    expect(onBack).toHaveBeenCalled()
  })

  it('moves to a scan chosen in the queue and announces it', async () => {
    narrowScreen(false)
    mount(three())
    await userEvent.click(
      within(screen.getByRole('list', {name: 'Scans in this batch'})).getByRole('button', {
        name: /Sam Third/,
      }),
    )
    expect(await screen.findByRole('heading', {name: 'Scan for Sam Third'})).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Reviewing Sam Third, 3 of 3.')
  })

  it('blocks apply while an item has a problem', () => {
    narrowScreen(false)
    mount([
      scanFor(5, 'Pat Student', {
        summary: {blocking: 1},
        rows: [
          {
            ...scanRecord().rows[0],
            errors: ['The time multiplier must be more than 1 and at most 5.'],
            action: 'error',
          },
        ],
      }),
      scanFor(6, 'Riley Other'),
    ])
    expect(screen.getByRole('alert')).toHaveTextContent('time multiplier')
    expect(screen.getByRole('button', {name: 'Apply & next'})).toBeDisabled()
    expect(screen.getByText(/Fix the items marked with problems/)).toBeInTheDocument()
  })

  it('blocks apply until a name mismatch is confirmed', async () => {
    narrowScreen(false)
    mount([
      scanFor(5, 'Pat Student', {
        scan: {...scanRecord().scan, student_name_on_doc: 'Riley Other', mismatch: true},
      }),
    ])
    expect(screen.getByText(/names a different student/)).toHaveTextContent('Riley Other')
    expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled()
    expect(screen.getByText(/Confirm that this is the right student/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', {name: /right student/}))
    await waitFor(() =>
      expect(requests.find(r => r.method === 'PUT')?.body).toMatchObject({
        acknowledged_mismatch: true,
      }),
    )
  })

  it('blocks apply without a plan type', () => {
    narrowScreen(false)
    mount([scanFor(5, 'Pat Student', {scan: {...scanRecord().scan, plan_type: null}})])
    expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled()
    expect(screen.getByText('Choose a plan type.')).toBeInTheDocument()
  })
})

describe('ReviewWorkspace editing', () => {
  it('sends an edit to an item and one to the plan', async () => {
    narrowScreen(false)
    mount(three())
    await userEvent.click(screen.getByRole('checkbox', {name: /Include Extended time/}))
    await waitFor(() =>
      expect(requests.find(r => r.method === 'PUT')?.body).toMatchObject({
        items: [{index: 0, included: false}],
      }),
    )
    await userEvent.selectOptions(screen.getByLabelText('Plan type'), '504')
    await waitFor(() =>
      expect(requests.filter(r => r.method === 'PUT').at(-1)?.body).toMatchObject({
        plan: {plan_type: '504'},
      }),
    )
  })

  it('keeps a note that was not mapped', async () => {
    narrowScreen(false)
    mount(three())
    await userEvent.click(screen.getByRole('checkbox', {name: /Keep.*Speech therapy/}))
    await waitFor(() =>
      expect(requests.find(r => r.method === 'PUT')?.body).toMatchObject({keep_unmapped: [0]}),
    )
  })

  it('in a single scan applies, announces it and can undo', async () => {
    narrowScreen(false)
    mount([scanFor(5, 'Pat Student')])
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}))
    expect(await screen.findByRole('status')).toHaveTextContent(/Applied/)
    await userEvent.click(await screen.findByRole('button', {name: 'Undo'}))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Undone/))
  })

  it('does not move on when the server refused the apply', async () => {
    narrowScreen(false)
    server.use(
      http.post('/api/v1/supports/imports/:id/apply', () =>
        HttpResponse.json({errors: ['Confirm the student first.']}, {status: 409}),
      ),
    )
    mount(three())
    await userEvent.click(screen.getByRole('button', {name: 'Apply & next'}))
    expect(await screen.findByText('Confirm the student first.')).toBeInTheDocument()
    expect(screen.getByRole('heading', {name: 'Scan for Pat Student'})).toBeInTheDocument()
  })
})

describe('ReviewWorkspace with nothing to review', () => {
  it('says so when every scan was skipped', async () => {
    narrowScreen(false)
    const onBack = vi.fn()
    mount(
      [
        scanFor(5, 'Pat Student', {workflow_state: 'discarded'}),
        scanFor(6, 'Riley Other', {workflow_state: 'discarded'}),
      ],
      {onBack},
    )
    expect(screen.getByText('Nothing left to review.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Back to matches'}))
    expect(onBack).toHaveBeenCalled()
  })

  it('says so with no scans at all', () => {
    narrowScreen(false)
    mount([], {startAt: 0})
    expect(screen.getByText('Nothing left to review.')).toBeInTheDocument()
  })

  it('shows a scan that was already applied, with Undo', () => {
    narrowScreen(false)
    mount([scanFor(5, 'Pat Student', {workflow_state: 'applied'})])
    expect(screen.queryByText('Nothing left to review.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Undo'})).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Apply'})).not.toBeInTheDocument()
  })

  it('skipping the only remaining scan returns with a message', async () => {
    narrowScreen(false)
    const onBack = vi.fn()
    mount([scanFor(5, 'Pat Student'), scanFor(6, 'Riley Other', {workflow_state: 'applied'})], {
      onBack,
    })
    await userEvent.click(screen.getByRole('button', {name: 'Skip'}))
    await waitFor(() => expect(onBack).toHaveBeenCalled())
    expect(onBack.mock.calls[0][0]).toMatch(/Skipped\. That was the last scan to review/)
  })
})
