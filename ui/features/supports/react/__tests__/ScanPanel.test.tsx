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
import {render, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import ScanPanel from '../ScanPanel'
import type {ScanBatch, ScanRecord} from '../types'
import {batchOf, match, scanRecord, unmatched} from './fixtures'

const record = scanRecord

let current: ScanRecord
let currentBatch: ScanBatch
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
  http.post('/api/v1/supports/scan_batches', () => HttpResponse.json(currentBatch)),
  http.get('/api/v1/supports/scan_batches/1', () => HttpResponse.json(currentBatch)),
  http.put('/api/v1/supports/imports/6/student', async ({request}) => {
    await note(request)
    return HttpResponse.json({
      ...unmatched(6, 'b.pdf', null),
      student: {id: '7', name: 'Pat Student'},
      rows: record().rows,
    })
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

  it('goes back to the form with Scan another after applying', async () => {
    current = record()
    renderPanel()
    await upload()
    await userEvent.click(await screen.findByRole('button', {name: 'Apply'}))
    await userEvent.click(await screen.findByRole('button', {name: 'Scan another'}))
    expect(await screen.findByRole('button', {name: 'Scan'})).toBeInTheDocument()
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
    Object.defineProperty(big, 'size', {value: 21 * 1024 * 1024})
    await userEvent.upload(screen.getByLabelText('IEP file'), big)
    await userEvent.click(screen.getByRole('button', {name: 'Scan'}))
    expect(await screen.findByText(/larger than 20 MB/)).toBeInTheDocument()
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

  describe('several IEPs', () => {
    const pat = {id: '7', name: 'Pat Student', sis_user_id: '2009', reason: 'id' as const}

    it('offers One IEP and Several IEPs, and One IEP is the form it always was', () => {
      renderPanel()
      expect(screen.getByRole('button', {name: 'One IEP', pressed: true})).toBeInTheDocument()
      expect(screen.getByRole('button', {name: 'Several IEPs', pressed: false})).toBeInTheDocument()
      expect(screen.getByLabelText('IEP file')).toBeInTheDocument()
      expect(screen.getByRole('button', {name: 'Scan'})).toBeInTheDocument()
    })

    it('uploads several, matches them, confirms, and opens one to review', async () => {
      currentBatch = batchOf([
        unmatched(6, 'b.pdf', match('confident', [pat], '2009')),
        unmatched(7, 'c.pdf', match('none')),
      ])
      renderPanel()
      await userEvent.click(screen.getByRole('button', {name: 'Several IEPs'}))
      expect(screen.queryByLabelText('IEP file')).not.toBeInTheDocument()
      const file = new File(['%PDF-1.4'], 'b.pdf', {type: 'application/pdf'})
      await userEvent.upload(screen.getByLabelText('IEP files'), file)
      await userEvent.click(screen.getByRole('button', {name: 'Upload'}))
      expect(await screen.findByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('status')).toHaveLength(1)

      await userEvent.click(screen.getByRole('button', {name: 'Confirm b.pdf'}))
      await waitFor(() => expect(requests.some(r => r.path.endsWith('/6/student'))).toBe(true))
      await userEvent.click(await screen.findByRole('button', {name: 'Review 1 scan'}))
      expect(
        await screen.findByRole('heading', {name: 'Extended time on tests and quizzes'}),
      ).toBeInTheDocument()
      expect(screen.getAllByRole('status')).toHaveLength(1)
    })

    it('reviews a batch with Apply & next, then returns to the table with a message', async () => {
      const confirmed = (id: number, name: string) =>
        scanRecord({id, filename: `${name}.pdf`, student: {id: String(id), name}, batch_id: 1})
      currentBatch = batchOf([confirmed(5, 'Pat Student'), confirmed(8, 'Riley Other')])
      server.use(
        http.post('/api/v1/supports/imports/:id/apply', async ({params, request}) => {
          await note(request)
          return HttpResponse.json({
            ...currentBatch.files.find(f => String(f.id) === params.id)!,
            workflow_state: 'applied',
          })
        }),
      )
      renderPanel()
      await userEvent.click(screen.getByRole('button', {name: 'Several IEPs'}))
      await userEvent.upload(
        screen.getByLabelText('IEP files'),
        new File(['%PDF-1.4'], 'a.pdf', {type: 'application/pdf'}),
      )
      await userEvent.click(screen.getByRole('button', {name: 'Upload'}))
      await userEvent.click(await screen.findByRole('button', {name: 'Review 2 scans'}))
      expect(screen.getByRole('heading', {name: 'Scan for Pat Student'})).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', {name: 'Apply & next'}))
      const next = await screen.findByRole('heading', {name: 'Scan for Riley Other'})
      await waitFor(() => expect(next).toHaveFocus())

      await userEvent.click(screen.getByRole('button', {name: 'Apply & next'}))
      expect(await screen.findByRole('table')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(/That was the last scan to review/)
      expect(screen.getAllByRole('status')).toHaveLength(1)
      expect(
        within(screen.getByRole('row', {name: /Pat Student\.pdf/})).getByText('Applied'),
      ).toBeInTheDocument()
    })
  })
})
