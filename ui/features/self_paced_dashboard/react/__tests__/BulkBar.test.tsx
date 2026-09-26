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
import doFetchApi from '@canvas/do-fetch-api-effect'
import BulkBar from '../BulkBar'
import {rosterRow} from './fixtures'

vi.mock('@canvas/do-fetch-api-effect', () => ({
  __esModule: true,
  default: vi.fn(),
}))

const mockFetch = vi.mocked(doFetchApi)
const BULK_URL = '/api/v1/self_paced/interventions/bulk'

const biology = {id: '7', name: 'Biology', course_code: 'BIO'}
const rows = [
  rosterRow({id: '1', name: 'Maya Lopez'}),
  rosterRow({id: '1', name: 'Maya Lopez', course: biology, attempts_on_current_item: 4}),
  rosterRow({id: '2', name: 'Jordan Kim'}),
]

function respond(results: unknown) {
  mockFetch.mockImplementation(({path}: {path: string}) => {
    if (path === BULK_URL)
      return Promise.resolve({json: {id: '50', workflow_state: 'queued'}} as never)
    return Promise.resolve({json: {id: '50', workflow_state: 'completed', results}} as never)
  })
}

function renderBar() {
  const props = {url: BULK_URL, rows, onClear: vi.fn(), onDone: vi.fn(), pollMs: 0}
  render(<BulkBar {...props} />)
  return props
}

describe('BulkBar', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('counts students, not classes', () => {
    respond({done: 0, failed: []})
    renderBar()

    expect(screen.getByText('2 students selected')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Extra try where stuck (1)'})).toBeEnabled()
  })

  it('messages each student once and reports back', async () => {
    respond({done: 2, failed: []})
    const props = renderBar()
    await userEvent.click(screen.getByRole('button', {name: 'Message'}))
    await userEvent.type(screen.getByLabelText(/^Message/, {selector: 'textarea'}), 'Check in at 2')
    await userEvent.click(screen.getByRole('button', {name: 'Send'}))

    expect(mockFetch).toHaveBeenCalledWith({
      path: BULK_URL,
      method: 'POST',
      body: {
        kind: 'message',
        subject: '',
        body: 'Check in at 2',
        targets: [
          {course_id: '4', student_id: '1'},
          {course_id: '4', student_id: '2'},
        ],
      },
    })
    expect(await screen.findByText('Done for 2 students.')).toBeInTheDocument()
    expect(props.onDone).toHaveBeenCalled()
  })

  it('acts on one chosen item for everyone on a course page', async () => {
    respond({done: 2, failed: []})
    const tools = {
      unlock: true,
      mark_complete: true,
      exempt: true,
      exempt_graded: false,
      extra_attempts: false,
      reset_attempt: false,
      adjust_target: true,
      note: true,
      message: true,
    }
    render(
      <BulkBar
        url={BULK_URL}
        rows={[rosterRow({id: '1', name: 'Maya Lopez'}), rosterRow({id: '2', name: 'Jordan Kim'})]}
        onClear={vi.fn()}
        onDone={vi.fn()}
        pollMs={0}
        items={[
          {id: '101', title: '1.1 Check', module: 'Unit 1', graded: true, attempts_limited: true},
        ]}
        tools={tools}
      />,
    )
    await userEvent.click(screen.getByRole('button', {name: 'Item action'}))
    // a mentor can't give tries, so it isn't offered
    expect(screen.queryByRole('option', {name: 'Give extra tries'})).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Item'), '101')
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'mark_complete')
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}))

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          kind: 'mark_complete',
          content_tag_id: '101',
          targets: [
            {course_id: '4', student_id: '1'},
            {course_id: '4', student_id: '2'},
          ],
        }),
      }),
    )
    expect(await screen.findByText('Done for 2 students.')).toBeInTheDocument()
  })

  it('gives an extra try only where a student is stuck, and names who it missed', async () => {
    respond({
      done: 0,
      failed: [{course_id: '7', student_id: '1', name: 'Maya Lopez', error: 'no permission'}],
    })
    renderBar()
    await userEvent.click(screen.getByRole('button', {name: 'Extra try where stuck (1)'}))
    await userEvent.click(screen.getByRole('button', {name: 'Give tries'}))

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          kind: 'extra_attempts',
          content_tag_id: 'current',
          attempts: 1,
          targets: [{course_id: '7', student_id: '1'}],
        }),
      }),
    )
    expect(
      await screen.findByText('Done for 0 students. Not done for: Maya Lopez (no permission).'),
    ).toBeInTheDocument()
  })
})
