/*
 * Copyright (C) 2026 - present EXAMPLE contributors
 *
 * This file is part of EXAMPLE LMS, a modified version of Canvas.
 *
 * EXAMPLE LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react'
import {render, screen} from '@testing-library/react'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {MAP} from '@canvas/self-paced/__tests__/playerFixtures'
import PlayerApp from '../PlayerApp'

vi.mock('@canvas/do-fetch-api-effect', () => ({
  __esModule: true,
  default: vi.fn(),
}))

const mockFetch = vi.mocked(doFetchApi)

function renderApp(map = MAP) {
  mockFetch.mockResolvedValue({json: map} as never)
  render(
    <PlayerApp config={{map_url: '/api/v1/courses/4/self_paced/map', course_color: '#eb6834'}} />,
  )
}

describe('PlayerApp', () => {
  // braces matter: a function returned from beforeEach runs as a cleanup hook
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('shows progress and a button to continue where the student left off', async () => {
    renderApp()

    expect(await screen.findByText('1 of 4 steps done (25%)')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Continue: 1.1 Classwork'})).toHaveAttribute(
      'href',
      '/courses/4/modules/items/11',
    )
  })

  it('links steps the student can open and not locked ones', async () => {
    renderApp()

    expect(await screen.findByRole('link', {name: /1\.1 Lesson/})).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: /Ready, Set, Go/})).not.toBeInTheDocument()
    expect(screen.getByText('1.1 Ready, Set, Go')).toBeInTheDocument()
  })

  it('tells screen readers what state each step is in', async () => {
    renderApp()

    expect(await screen.findByText('(completed)')).toBeInTheDocument()
    expect(screen.getByText('(up next)')).toBeInTheDocument()
    expect(screen.getAllByText('(locked)')).toHaveLength(2)
  })

  it('labels each step with its role and time', async () => {
    renderApp()

    expect(await screen.findByText('about 15 min')).toBeInTheDocument()
    expect(screen.getByText('Check')).toBeInTheDocument()
  })

  it('celebrates a finished course instead of offering to continue', async () => {
    renderApp({...MAP, requirements_completed: 4, percent_complete: 100})

    expect(
      await screen.findByText("You've finished every step in this course. Well done!"),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: /Continue/})).not.toBeInTheDocument()
  })

  it('explains when the map fails to load', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error('nope')))
    render(<PlayerApp config={{map_url: '/x'}} />)

    expect(await screen.findByText(/Your course map didn't load/)).toBeInTheDocument()
  })
})
