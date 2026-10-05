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
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import InstallStatusApp from '../InstallStatusApp'

const server = setupServer(
  http.get('/api/v1/users/self/onboarding/install', () =>
    HttpResponse.json({
      key: 'install',
      title: 'Finish installing',
      url: '/install_status',
      done_count: 0,
      total: 0,
      steps: [],
    }),
  ),
)

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterAll(() => server.close())

describe('InstallStatusApp', () => {
  it('shows the page title, the guide link and the installer checklist', async () => {
    render(<InstallStatusApp track="install" />)
    expect(screen.getByRole('heading', {level: 1, name: 'Finish installing'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Read the install guide'})).toHaveAttribute(
      'href',
      expect.stringContaining('docs/install.md'),
    )
    expect(await screen.findByText('0 of 0 done')).toBeInTheDocument()
  })
})
