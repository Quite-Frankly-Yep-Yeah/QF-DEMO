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
import ScanPanel from '../ScanPanel'
import type {ScanRecord} from '../types'

const record = (
  overrides: Partial<ScanRecord> = {},
  scan: Partial<ScanRecord['scan']> = {},
): ScanRecord => ({
  id: 5,
  filename: 'iep.pdf',
  format: 'iep_scan',
  workflow_state: 'previewed',
  created_at: null,
  applied_at: null,
  undone_at: null,
  extraction_state: 'ready',
  extraction_error: null,
  student: {id: '7', name: 'Pat Student'},
  plan_id: null,
  summary: {add: 1, blocking: 0},
  rows: [
    {
      index: 0,
      line: 1,
      accommodation: 'Extended time on tests and quizzes',
      kind: 'extended_time',
      params: {multiplier: 1.5},
      action: 'add',
      message: null,
      source_quote: 'time and a half on tests',
      page: 3,
      confidence: 'high',
      errors: [],
      included: true,
    },
  ],
  scan: {
    student_name_on_doc: 'Pat Student',
    dob_on_doc: null,
    name_found: true,
    mismatch: false,
    acknowledged_mismatch: false,
    unmapped: [{text: 'Speech therapy 30 min weekly', page: 5}],
    keep_unmapped: [],
    plan_type: 'iep',
    start_date: '2026-09-01',
    end_date: '2027-06-15',
    ...scan,
  },
  ...overrides,
})

let current: ScanRecord
const requests: {method: string; path: string; body?: unknown}[] = []
const note = async (request: Request) => {
  const text = await request.text()
  let body: unknown
  try {
    body = text.startsWith('{') ? JSON.parse(text) : undefined
  } catch {
    body = undefined
  }
  requests.push({method: request.method, path: new URL(request.url).pathname, body})
}

const server = setupServer(
  http.get('/api/v1/supports/students', () =>
    HttpResponse.json({students: [{id: '7', name: 'Pat Student'}]}),
  ),
  http.post('/api/v1/supports/imports', async ({request}) => {
    await note(request)
    return HttpResponse.json(current)
  }),
  http.get('/api/v1/supports/imports/5', () => HttpResponse.json(current)),
  http.put('/api/v1/supports/imports/5/review', async ({request}) => {
    await note(request)
    return HttpResponse.json(current)
  }),
  http.post('/api/v1/supports/imports/5/retry', async ({request}) => {
    await note(request)
    return HttpResponse.json(record({extraction_state: 'queued'}))
  }),
  http.post('/api/v1/supports/imports/5/apply', async ({request}) => {
    await note(request)
    return HttpResponse.json(record({workflow_state: 'applied', plan_id: 9}))
  }),
  http.post('/api/v1/supports/imports/5/undo', async ({request}) => {
    await note(request)
    return HttpResponse.json(record({workflow_state: 'undone', plan_id: 9}))
  }),
  http.delete('/api/v1/supports/imports/5', async ({request}) => {
    await note(request)
    return HttpResponse.json(record({workflow_state: 'discarded'}))
  }),
)

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  requests.length = 0
})
afterAll(() => server.close())

async function upload() {
  await userEvent.type(screen.getByLabelText(/Student/), 'Pat')
  await userEvent.click(await screen.findByRole('button', {name: 'Pat Student'}))
  const file = new File(['%PDF-1.4'], 'iep.pdf', {type: 'application/pdf'})
  await userEvent.upload(screen.getByLabelText('IEP file'), file)
  await userEvent.click(screen.getByRole('button', {name: 'Scan'}))
}

const renderPanel = () => render(<ScanPanel accountId="1" pollMs={5} />)

describe('ScanPanel', () => {
  it('uploads for the chosen student, waits while it is read, then shows what it found', async () => {
    current = record({extraction_state: 'queued'})
    renderPanel()
    await upload()
    expect(await screen.findByText(/Reading the document/)).toBeInTheDocument()
    expect(requests[0]).toMatchObject({method: 'POST', path: '/api/v1/supports/imports'})

    current = record()
    expect(
      await screen.findByRole('heading', {name: 'Extended time on tests and quizzes'}),
    ).toBeInTheDocument()
    expect(screen.getByText(/Speech therapy 30 min weekly/)).toBeInTheDocument()
  })

  it('blocks apply while an item has a problem', async () => {
    current = record({
      summary: {blocking: 1},
      rows: [
        {
          ...record().rows[0],
          errors: ['The time multiplier must be more than 1 and at most 5.'],
          action: 'error',
        },
      ],
    })
    renderPanel()
    await upload()
    expect(await screen.findByRole('alert')).toHaveTextContent('time multiplier')
    expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled()
    expect(screen.getByText(/Fix the items marked with problems/)).toBeInTheDocument()
  })

  it('warns about another student and needs it confirmed before apply', async () => {
    current = record({}, {student_name_on_doc: 'Riley Other', mismatch: true})
    renderPanel()
    await upload()
    expect(await screen.findByText(/names a different student/)).toHaveTextContent('Riley Other')
    expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', {name: /right student/}))
    await waitFor(() =>
      expect(requests.find(r => r.method === 'PUT')?.body).toMatchObject({
        acknowledged_mismatch: true,
      }),
    )
  })

  it('keeps a note that was not mapped', async () => {
    current = record()
    renderPanel()
    await upload()
    await userEvent.click(await screen.findByRole('checkbox', {name: /Keep.*Speech therapy/}))
    await waitFor(() =>
      expect(requests.find(r => r.method === 'PUT')?.body).toMatchObject({keep_unmapped: [0]}),
    )
  })

  it('sends an edit to an item and one to the plan', async () => {
    current = record()
    renderPanel()
    await upload()
    await userEvent.click(await screen.findByRole('checkbox', {name: /Include Extended time/}))
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

  it('shows a failed read with a way to try again', async () => {
    current = record({
      extraction_state: 'failed',
      extraction_error: "The document couldn't be read.",
    })
    renderPanel()
    await upload()
    expect(await screen.findByText("The document couldn't be read.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}))
    await waitFor(() => expect(requests.some(r => r.path.endsWith('/retry'))).toBe(true))
  })

  it('applies, announces it, and can undo', async () => {
    current = record()
    renderPanel()
    await upload()
    await userEvent.click(await screen.findByRole('button', {name: 'Apply'}))
    expect(await screen.findByRole('status')).toHaveTextContent(/Applied/)
    await userEvent.click(await screen.findByRole('button', {name: 'Undo'}))
    expect(await screen.findByRole('status')).toHaveTextContent(/Undone/)
  })

  it('discards a preview', async () => {
    current = record()
    renderPanel()
    await upload()
    await userEvent.click(await screen.findByRole('button', {name: 'Discard'}))
    await waitFor(() => expect(requests.some(r => r.method === 'DELETE')).toBe(true))
    expect(await screen.findByRole('button', {name: 'Scan'})).toBeInTheDocument()
  })

  it('refuses a file that is too large before sending it', async () => {
    renderPanel()
    await userEvent.type(screen.getByLabelText(/Student/), 'Pat')
    await userEvent.click(await screen.findByRole('button', {name: 'Pat Student'}))
    const big = new File(['x'], 'big.pdf', {type: 'application/pdf'})
    Object.defineProperty(big, 'size', {value: 11 * 1024 * 1024})
    await userEvent.upload(screen.getByLabelText('IEP file'), big)
    await userEvent.click(screen.getByRole('button', {name: 'Scan'}))
    expect(await screen.findByText(/larger than 10 MB/)).toBeInTheDocument()
    expect(requests).toHaveLength(0)
  })
  it('names the student the scan is for', async () => {
    current = record()
    renderPanel()
    await upload()
    expect(await screen.findByText('Scan for Pat Student')).toBeInTheDocument()
  })

  it('does not say it discarded when the server refused', async () => {
    current = record()
    server.use(
      http.delete('/api/v1/supports/imports/5', () =>
        HttpResponse.json({message: 'no'}, {status: 403}),
      ),
    )
    renderPanel()
    await upload()
    await userEvent.click(await screen.findByRole('button', {name: 'Discard'}))
    expect(await screen.findByRole('status')).not.toHaveTextContent('Discarded')
    expect(
      screen.getByRole('heading', {name: 'Extended time on tests and quizzes'}),
    ).toBeInTheDocument()
  })
})
