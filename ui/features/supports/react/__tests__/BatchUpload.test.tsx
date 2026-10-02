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
import BatchUpload from '../BatchUpload'
import {batchOf, unmatched} from './fixtures'

const posts: FormData[] = []
let reply: {status: number; body: unknown}

// jsdom's FormData can't travel through msw's fetch, so answer the upload here
beforeEach(() => {
  reply = {
    status: 200,
    body: batchOf([unmatched(1, 'a.pdf', null), unmatched(2, 'b.png', null)]),
  }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
    if (init?.body instanceof FormData) posts.push(init.body)
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: {'Content-Type': 'application/json'},
    })
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  posts.length = 0
})

const pdf = (name: string, size = 10, type = 'application/pdf') => {
  const file = new File(['x'], name, {type})
  Object.defineProperty(file, 'size', {value: size})
  return file
}

const choose = (files: File[]) =>
  fireEvent.change(screen.getByLabelText('IEP files'), {target: {files}})

describe('BatchUpload', () => {
  it('sends the chosen files and the account, then hands back the batch', async () => {
    const onStarted = vi.fn()
    render(<BatchUpload accountId="1" onStarted={onStarted} />)
    choose([pdf('a.pdf'), pdf('b.png', 10, 'image/png')])
    expect(screen.getByRole('status')).toHaveTextContent('2 files chosen')
    await userEvent.click(screen.getByRole('button', {name: 'Upload'}))
    await waitFor(() => expect(onStarted).toHaveBeenCalled())
    expect(onStarted.mock.calls[0][0].id).toBe(1)
    expect(posts[0].getAll('files[]').map(f => (f as File).name)).toEqual(['a.pdf', 'b.png'])
    expect(posts[0].get('account_id')).toBe('1')
  })

  it('refuses more than 25 files before sending anything', async () => {
    render(<BatchUpload accountId="1" onStarted={vi.fn()} />)
    choose(Array.from({length: 26}, (_, i) => pdf(`f${i}.pdf`)))
    expect(screen.getByRole('status')).toHaveTextContent(/at most 25/)
    expect(screen.getByRole('button', {name: 'Upload'})).toBeDisabled()
    expect(posts).toHaveLength(0)
  })

  it('names a file over 20 MB', () => {
    render(<BatchUpload accountId="1" onStarted={vi.fn()} />)
    choose([pdf('ok.pdf'), pdf('big.pdf', 21 * 1024 * 1024)])
    expect(screen.getByRole('status')).toHaveTextContent('big.pdf is larger than 20 MB.')
    expect(screen.getByRole('button', {name: 'Upload'})).toBeDisabled()
  })

  it('names an image over 5 MB', () => {
    render(<BatchUpload accountId="1" onStarted={vi.fn()} />)
    choose([pdf('scan.png', 6 * 1024 * 1024, 'image/png')])
    expect(screen.getByRole('status')).toHaveTextContent('scan.png is larger than 5 MB.')
  })

  it('names a file that is not a PDF or an image', () => {
    render(<BatchUpload accountId="1" onStarted={vi.fn()} />)
    choose([pdf('notes.txt', 10, 'text/plain')])
    expect(screen.getByRole('status')).toHaveTextContent(/notes\.txt .*PDF, PNG or JPEG/)
    expect(screen.getByRole('button', {name: 'Upload'})).toBeDisabled()
  })

  it('refuses more than 200 MB in all', () => {
    render(<BatchUpload accountId="1" onStarted={vi.fn()} />)
    choose(Array.from({length: 11}, (_, i) => pdf(`f${i}.pdf`, 19 * 1024 * 1024)))
    expect(screen.getByRole('status')).toHaveTextContent(/more than 200 MB/)
  })

  it('shows what the server refused and does not start a batch', async () => {
    reply = {status: 422, body: {errors: ['Too many files.']}}
    const onStarted = vi.fn()
    render(<BatchUpload accountId="1" onStarted={onStarted} />)
    choose([pdf('a.pdf')])
    await userEvent.click(screen.getByRole('button', {name: 'Upload'}))
    expect(await screen.findByText('Too many files.')).toBeInTheDocument()
    expect(onStarted).not.toHaveBeenCalled()
  })
})
