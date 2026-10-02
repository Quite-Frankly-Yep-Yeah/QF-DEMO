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
import MatchTable from '../MatchTable'
import type {ScanBatch, ScanRecord} from '../types'
import {batchOf, match, scanRecord, unmatched} from './fixtures'

const pat = {id: '7', name: 'Pat Student', sis_user_id: '2009', reason: 'id' as const}
const sam1 = {id: '8', name: 'Sam Same', sis_user_id: '111', reason: 'name' as const}
const sam2 = {id: '9', name: 'Sam Same', sis_user_id: '222', reason: 'name' as const}

const reading = (id: number, filename: string): ScanRecord =>
  scanRecord({id, filename, student: null, extraction_state: 'running', rows: [], batch_id: 1})

const requests: {method: string; path: string}[] = []
let remote: ScanBatch
let pollFails = 0

const server = setupServer(
  http.get('/api/v1/supports/scan_batches/1', () => {
    requests.push({method: 'GET', path: '/scan_batches/1'})
    if (pollFails > 0) {
      pollFails -= 1
      return HttpResponse.json({errors: ['boom']}, {status: 500})
    }
    return HttpResponse.json(remote)
  }),
  http.put('/api/v1/supports/imports/:id/student', async ({params, request}) => {
    const body = (await request.json()) as {student_id: string}
    requests.push({method: 'PUT', path: `/imports/${params.id}/student ${body.student_id}`})
    const file = remote.files.find(f => String(f.id) === params.id)!
    return HttpResponse.json({...file, student: {id: body.student_id, name: 'Chosen'}})
  }),
  http.delete('/api/v1/supports/imports/:id', ({params}) => {
    requests.push({method: 'DELETE', path: `/imports/${params.id}`})
    const file = remote.files.find(f => String(f.id) === params.id)!
    return HttpResponse.json({...file, workflow_state: 'discarded'})
  }),
  http.post('/api/v1/supports/imports/:id/retry', ({params}) => {
    requests.push({method: 'POST', path: `/imports/${params.id}/retry`})
    const file = remote.files.find(f => String(f.id) === params.id)!
    return HttpResponse.json({...file, extraction_state: 'queued', extraction_error: null})
  }),
  http.get('/api/v1/supports/students', () =>
    HttpResponse.json({students: [{id: '30', name: 'Zed Searched', sis_user_id: null}]}),
  ),
)

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  requests.length = 0
  pollFails = 0
})
afterAll(() => server.close())

function Harness({initial, onReview = vi.fn()}: {initial: ScanBatch; onReview?: () => void}) {
  const [batch, setBatch] = useState(initial)
  return (
    <MatchTable batch={batch} accountId="1" pollMs={10} onChange={setBatch} onReview={onReview} />
  )
}

const mount = (files: ScanRecord[], onReview?: () => void) => {
  remote = batchOf(files)
  return render(<Harness initial={remote} onReview={onReview} />)
}

const rowOf = (filename: string) => screen.getByRole('row', {name: new RegExp(filename)})

describe('MatchTable', () => {
  it('is a table with headers and a row per file', () => {
    mount([unmatched(1, 'a.pdf', match('none')), unmatched(2, 'b.pdf', match('none'))])
    for (const name of ['File', 'Status', 'Name on the IEP', 'Student', 'Why', 'Actions']) {
      expect(screen.getByRole('columnheader', {name})).toBeInTheDocument()
    }
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(within(rowOf('a.pdf')).getByText('Name on a.pdf')).toBeInTheDocument()
    expect(within(rowOf('a.pdf')).getByText('No match')).toBeInTheDocument()
  })

  it('shows Reading, Ready and Failed, and Try again asks for another read', async () => {
    const failed = {
      ...unmatched(3, 'c.pdf', null),
      extraction_state: 'failed' as const,
      extraction_error: "The document couldn't be read.",
    }
    mount([reading(1, 'a.pdf'), unmatched(2, 'b.pdf', match('none')), failed])
    expect(within(rowOf('a.pdf')).getByText('Reading')).toBeInTheDocument()
    expect(within(rowOf('b.pdf')).getByText('Ready')).toBeInTheDocument()
    expect(within(rowOf('c.pdf')).getByText('Failed')).toBeInTheDocument()
    expect(within(rowOf('c.pdf')).getByText("The document couldn't be read.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Try again c.pdf'}))
    await waitFor(() => expect(requests).toContainEqual({method: 'POST', path: '/imports/3/retry'}))
    expect(await screen.findByText('Reading')).toBeInTheDocument()
  })

  it('pre-selects the student for a confident row and offers candidates for the rest', () => {
    mount([
      unmatched(1, 'a.pdf', match('confident', [pat], '2009')),
      unmatched(2, 'b.pdf', match('ambiguous', [sam1, sam2])),
    ])
    expect(screen.getByLabelText('Student for a.pdf')).toHaveValue('7')
    expect(within(rowOf('a.pdf')).getByText('SIS ID matches')).toBeInTheDocument()
    const select = screen.getByLabelText('Student for b.pdf')
    expect(select).toHaveValue('')
    expect(within(select).getAllByRole('option', {name: /Sam Same/})).toHaveLength(2)
    expect(within(rowOf('b.pdf')).getByText('Name matches 2 students')).toBeInTheDocument()
  })

  it('confirms the chosen student with PUT imports/:id/student', async () => {
    mount([unmatched(2, 'b.pdf', match('ambiguous', [sam1, sam2]))])
    await userEvent.selectOptions(screen.getByLabelText('Student for b.pdf'), '9')
    await userEvent.click(screen.getByRole('button', {name: 'Confirm b.pdf'}))
    await waitFor(() =>
      expect(requests).toContainEqual({method: 'PUT', path: '/imports/2/student 9'}),
    )
    expect(await within(rowOf('b.pdf')).findByText('Confirmed')).toBeInTheDocument()
  })

  it('cannot confirm until a student is chosen', () => {
    mount([unmatched(2, 'b.pdf', match('ambiguous', [sam1, sam2]))])
    expect(screen.getByRole('button', {name: 'Confirm b.pdf'})).toBeDisabled()
  })

  it('lets a person search for a student when nothing matched', async () => {
    mount([unmatched(2, 'b.pdf', match('none'))])
    await userEvent.type(screen.getByLabelText('Search for a student for b.pdf'), 'Zed')
    await userEvent.click(await screen.findByRole('button', {name: 'Zed Searched'}))
    expect(screen.getByLabelText('Student for b.pdf')).toHaveValue('30')
    await userEvent.click(screen.getByRole('button', {name: 'Confirm b.pdf'}))
    await waitFor(() =>
      expect(requests).toContainEqual({method: 'PUT', path: '/imports/2/student 30'}),
    )
  })

  it('lets a confirmed row be changed before it is applied', async () => {
    const confirmed = scanRecord(
      {id: 4, filename: 'd.pdf', batch_id: 1},
      {student_name_on_doc: 'P. Student'},
    )
    mount([confirmed])
    expect(within(rowOf('d.pdf')).getByText('Pat Student')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Change student for d.pdf'}))
    expect(screen.getByLabelText('Student for d.pdf')).toHaveValue('7')
    expect(
      within(screen.getByLabelText('Student for d.pdf')).getByRole('option', {name: /Pat Student/}),
    ).toBeInTheDocument()
  })

  it('skips a file and shows it as Skipped', async () => {
    mount([unmatched(2, 'b.pdf', match('none'))])
    await userEvent.click(screen.getByRole('button', {name: 'Skip b.pdf'}))
    await waitFor(() => expect(requests).toContainEqual({method: 'DELETE', path: '/imports/2'}))
    expect(await within(rowOf('b.pdf')).findByText('Skipped')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Skip b.pdf'})).not.toBeInTheDocument()
  })

  it('confirms only the exact matches with one click and says how many', async () => {
    mount([
      unmatched(1, 'a.pdf', match('confident', [pat], '2009')),
      unmatched(2, 'b.pdf', match('ambiguous', [sam1, sam2])),
      unmatched(3, 'c.pdf', match('none')),
      unmatched(4, 'd.pdf', match('confident', [{...sam1, id: '12'}])),
    ])
    await userEvent.click(screen.getByRole('button', {name: 'Confirm all exact matches'}))
    expect(await screen.findByText(/Confirmed 2 exact matches/)).toBeInTheDocument()
    expect(requests.filter(r => r.method === 'PUT').map(r => r.path)).toEqual([
      '/imports/1/student 7',
      '/imports/4/student 12',
    ])
    expect(screen.getByRole('button', {name: 'Confirm all exact matches'})).toBeDisabled()
  })

  it('does not confirm anything on its own when no row is confident', () => {
    mount([unmatched(2, 'b.pdf', match('ambiguous', [sam1, sam2]))])
    expect(screen.getByRole('button', {name: 'Confirm all exact matches'})).toBeDisabled()
  })

  it('announces progress in the one status region and keeps polling until all are read', async () => {
    mount([reading(1, 'a.pdf'), reading(2, 'b.pdf')])
    expect(screen.getByRole('status')).toHaveTextContent('0 of 2 read')
    remote = batchOf([unmatched(1, 'a.pdf', match('none')), reading(2, 'b.pdf')])
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 of 2 read'))
    remote = batchOf([unmatched(1, 'a.pdf', match('none')), unmatched(2, 'b.pdf', match('none'))])
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('All 2 files read'))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    const polls = requests.length
    await new Promise(resolve => setTimeout(resolve, 60))
    expect(requests.length).toBe(polls)
  })

  it('keeps the table and tries again when a poll fails', async () => {
    pollFails = 2
    mount([reading(1, 'a.pdf')])
    remote = batchOf([unmatched(1, 'a.pdf', match('none'))])
    await waitFor(() => expect(requests.filter(r => r.method === 'GET').length).toBeGreaterThan(2))
    expect(await within(rowOf('a.pdf')).findByText('Ready')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('offers Review N scans only once one is confirmed', async () => {
    const onReview = vi.fn()
    mount(
      [scanRecord({id: 4, filename: 'd.pdf', batch_id: 1}), unmatched(2, 'b.pdf', match('none'))],
      onReview,
    )
    const review = screen.getByRole('button', {name: 'Review 1 scan'})
    expect(review).toBeEnabled()
    await userEvent.click(review)
    expect(onReview).toHaveBeenCalled()
  })

  it('disables Review until a scan is confirmed', () => {
    mount([unmatched(2, 'b.pdf', match('none'))])
    expect(screen.getByRole('button', {name: 'Review 0 scans'})).toBeDisabled()
  })

  it('shows what the server refused', async () => {
    server.use(
      http.put('/api/v1/supports/imports/:id/student', () =>
        HttpResponse.json({errors: ['Pick a student you manage.']}, {status: 403}),
      ),
    )
    mount([unmatched(1, 'a.pdf', match('confident', [pat]))])
    await userEvent.click(screen.getByRole('button', {name: 'Confirm a.pdf'}))
    expect(await screen.findByText(/Pick a student you manage/)).toBeInTheDocument()
    expect(within(rowOf('a.pdf')).queryByText('Confirmed')).not.toBeInTheDocument()
  })
})
