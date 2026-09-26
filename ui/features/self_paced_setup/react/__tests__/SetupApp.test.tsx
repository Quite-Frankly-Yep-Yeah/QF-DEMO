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
import doFetchApi from '@canvas/do-fetch-api-effect'
import SetupApp, {requirementPreview, type Setup, type SetupItem} from '../SetupApp'

vi.mock('@canvas/do-fetch-api-effect', () => ({
  __esModule: true,
  default: vi.fn(),
}))

const mockFetch = vi.mocked(doFetchApi)

const item = (overrides: Partial<SetupItem>): SetupItem => ({
  id: '1',
  title: 'Item',
  type: 'WikiPage',
  scoreable: false,
  role: 'instruction',
  estimated_minutes: null,
  mastery_threshold: null,
  watch_fraction: null,
  max_attempts: null,
  retake_review: false,
  ...overrides,
})

const SETUP: Setup = {
  mastery_threshold: 70,
  provisional_checks: false,
  modules: [
    {
      id: '5',
      name: 'Unit 1',
      items: [
        item({id: '9', title: 'Lesson 1.1', type: 'ContextModuleSubHeader', role: 'none'}),
        item({id: '10', title: '1.1 Lesson', estimated_minutes: 15}),
        item({
          id: '12',
          title: '1.1 Ready, Set, Go',
          type: 'Quizzes::Quiz',
          scoreable: true,
          role: 'check',
        }),
      ],
    },
  ],
}

const config = {setup_url: '/api/v1/courses/4/self_paced/setup', player_url: '/courses/4/player'}

describe('requirementPreview', () => {
  it('describes what students must do for each role', () => {
    expect([
      requirementPreview(item({role: 'instruction'}), 70),
      requirementPreview(item({role: 'instruction', watch_fraction: 0.95}), 70),
      requirementPreview(item({role: 'practice', scoreable: true}), 70),
      requirementPreview(item({role: 'check', scoreable: true}), 70),
      requirementPreview(item({role: 'check', scoreable: true, mastery_threshold: 85}), 70),
      requirementPreview(item({role: 'none'}), 70),
    ]).toEqual([
      'Open the page',
      'Watch 95% of the video',
      'Submit it',
      'Score 70% or more',
      'Score 85% or more',
      null,
    ])
  })
})

describe('SetupApp', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({json: SETUP} as never)
  })

  it('shows each item with what students must do', async () => {
    render(<SetupApp config={config} />)

    expect(await screen.findByText('1.1 Ready, Set, Go')).toBeInTheDocument()
    expect(screen.getByText('Students must: Score 70% or more')).toBeInTheDocument()
    expect(screen.getByText('Students must: Open the page')).toBeInTheDocument()
  })

  it('offers retake and attempt settings only for checks', async () => {
    render(<SetupApp config={config} />)

    expect(await screen.findAllByLabelText('Review the lesson before each retake')).toHaveLength(1)
    expect(screen.getAllByLabelText('Must watch the video')).toHaveLength(1)
  })

  it('saves every item and the course settings together', async () => {
    render(<SetupApp config={config} />)
    await userEvent.click(await screen.findByLabelText('Must watch the video'))
    await userEvent.click(
      screen.getByLabelText('Let students continue while a check waits for grading'),
    )
    await userEvent.click(screen.getByRole('button', {name: 'Save and apply to modules'}))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({method: 'PUT'})),
    )
    const body = mockFetch.mock.calls.find(
      ([opts]) => (opts as {method?: string}).method === 'PUT',
    )?.[0].body as {
      provisional_checks: boolean
      items: {id: string; watch_fraction: number | null}[]
    }
    expect(body.provisional_checks).toBe(true)
    expect(body.items.find(i => i.id === '10')?.watch_fraction).toBe(0.95)
    expect(
      await screen.findByText('Saved. Modules now unlock in order using these rules.'),
    ).toBeInTheDocument()
  })
})
