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
import ParentInviteMenu, {ParentInviteDialog, printableInvite} from '../ParentInviteMenu'

const INVITE = {
  code: 'abc123',
  url: 'http://192.168.1.154/parents/join/abc123',
  expires_at: '2026-10-02T15:00:00Z',
  qr_svg: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>',
}

let requests: string[] = []
const server = setupServer(
  http.post('/api/v1/self_paced/students/7/parent_invite', ({request}) => {
    requests.push(new URL(request.url).pathname)
    return HttpResponse.json(INVITE)
  }),
)
beforeAll(() => server.listen())
beforeEach(() => {
  requests = []
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('ParentInviteDialog', () => {
  it('makes a code when opened and shows its QR code and link', async () => {
    render(
      <ParentInviteDialog studentId="7" studentName="Maya Lopez" open={true} onClose={() => {}} />,
    )

    expect(await screen.findByTestId('parent-invite-qr')).toBeInTheDocument()
    expect(screen.getByTestId('parent-invite-qr').querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('link', {name: INVITE.url})).toHaveAttribute('href', INVITE.url)
    expect(requests).toEqual(['/api/v1/self_paced/students/7/parent_invite'])
  })

  it('makes a fresh code on request', async () => {
    render(
      <ParentInviteDialog studentId="7" studentName="Maya Lopez" open={true} onClose={() => {}} />,
    )
    await screen.findByTestId('parent-invite-qr')
    await userEvent.click(screen.getByRole('button', {name: 'New code'}))

    expect(requests).toHaveLength(2)
  })

  it('says why when a code cannot be made', async () => {
    server.use(
      http.post(
        '/api/v1/self_paced/students/7/parent_invite',
        () => new HttpResponse(null, {status: 401}),
      ),
    )
    render(
      <ParentInviteDialog studentId="7" studentName="Maya Lopez" open={true} onClose={() => {}} />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't make a sign-up code")
  })

  it('copies the link', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {clipboard: {writeText}})
    render(
      <ParentInviteDialog studentId="7" studentName="Maya Lopez" open={true} onClose={() => {}} />,
    )
    await screen.findByTestId('parent-invite-qr')
    await userEvent.click(screen.getByRole('button', {name: 'Copy link'}))

    expect(writeText).toHaveBeenCalledWith(INVITE.url)
    expect(await screen.findByRole('button', {name: 'Copied'})).toBeInTheDocument()
  })
})

describe('ParentInviteMenu', () => {
  it('opens the dialog from the three-dot menu', async () => {
    render(<ParentInviteMenu studentId="7" studentName="Maya Lopez" />)
    expect(requests).toEqual([])

    await userEvent.click(screen.getByRole('button', {name: 'More options for Maya Lopez'}))
    await userEvent.click(await screen.findByText('Invite a parent (QR code)'))

    expect(await screen.findByTestId('parent-invite-qr')).toBeInTheDocument()
  })
})

describe('printableInvite', () => {
  it('has the QR code, the link and the expiry, and escapes the name', () => {
    const html = printableInvite('<b>Maya</b>', INVITE)

    expect(html).toContain(INVITE.qr_svg)
    expect(html).toContain(INVITE.url)
    expect(html).not.toContain('<b>Maya</b>')
    expect(html).toContain('expires on')
  })
})
