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
import doFetchApi from '@canvas/do-fetch-api-effect'
import {MAP} from '@canvas/self-paced/__tests__/playerFixtures'
import PlayerBar from '../PlayerBar'

vi.mock('@canvas/do-fetch-api-effect', () => ({
  __esModule: true,
  default: vi.fn(),
}))

const mockFetch = vi.mocked(doFetchApi)

function renderBar(moduleItemId: string | null) {
  mockFetch.mockResolvedValue({json: MAP} as never)
  render(
    <PlayerBar
      config={{
        map_url: '/api/v1/courses/4/self_paced/map',
        player_url: '/courses/4/player',
        module_item_id: moduleItemId,
      }}
    />,
  )
}

describe('PlayerBar', () => {
  // braces matter: a function returned from beforeEach runs as a cleanup hook
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('links to the previous and next steps', async () => {
    renderBar('11')

    expect(await screen.findByRole('link', {name: /Previous/})).toHaveAttribute(
      'href',
      '/courses/4/modules/items/10',
    )
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument()
  })

  it('keeps Next disabled and says why when the next step is locked', async () => {
    renderBar('11')

    expect(await screen.findByText('Finish this step to unlock the next one')).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: /Next/})).not.toBeInTheDocument()
  })

  it('opens the next step when it is available', async () => {
    renderBar('10')

    expect(await screen.findByRole('link', {name: /Next/})).toHaveAttribute(
      'href',
      '/courses/4/modules/items/11',
    )
  })

  it('always links back to the course map', async () => {
    renderBar(null)

    expect(await screen.findByText('25% done')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Course map'})).toHaveAttribute(
      'href',
      '/courses/4/player',
    )
  })
})
