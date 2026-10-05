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
import OnboardingChecklist from '../OnboardingChecklist'
import type {OnboardingStep, OnboardingTrack} from '../../types'

const step = (overrides: Partial<OnboardingStep>): OnboardingStep => ({
  key: 'mail',
  title: 'Set up outgoing mail',
  description: 'Add config/outgoing_mail.yml.',
  url: '/docs#mail',
  optional: false,
  detectable: false,
  detected: null,
  completed_at: null,
  dismissed_at: null,
  done: false,
  ...overrides,
})

const track = (steps: OnboardingStep[]): OnboardingTrack => {
  const required = steps.filter(s => !s.optional)
  return {
    key: 'install',
    title: 'Finish installing',
    url: '/install_status',
    done_count: required.filter(s => s.done).length,
    total: required.length,
    steps,
  }
}

const BASE = '/api/v1/users/self/onboarding/install'
const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('OnboardingChecklist', () => {
  it('shows progress, a detected step locked, and optional steps apart', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(
          track([
            step({
              key: 'domain',
              title: 'Set the domain',
              detectable: true,
              detected: true,
              done: true,
            }),
            step({}),
            step({key: 'ai_key', title: 'Add an API key', optional: true}),
          ]),
        ),
      ),
    )
    render(<OnboardingChecklist track="install" />)

    expect(await screen.findByText('1 of 2 done')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    const domain = screen.getByLabelText('Set the domain')
    expect(domain).toBeChecked()
    expect(domain).toBeDisabled()
    expect(screen.getByText('Detected')).toBeInTheDocument()
    expect(screen.getByRole('heading', {name: 'Optional'})).toBeInTheDocument()
    expect(screen.getByLabelText('Add an API key')).not.toBeChecked()
  })

  it('marks a step done', async () => {
    let body: unknown
    server.use(
      http.get(BASE, () => HttpResponse.json(track([step({})]))),
      http.put(`${BASE}/steps/mail`, async ({request}) => {
        body = await request.json()
        return HttpResponse.json(track([step({done: true, completed_at: '2026-10-05T00:00:00Z'})]))
      }),
    )
    render(<OnboardingChecklist track="install" />)

    await userEvent.click(await screen.findByLabelText('Set up outgoing mail'))
    await waitFor(() => expect(screen.getByLabelText('Set up outgoing mail')).toBeChecked())
    expect(body).toEqual({done: true})
    expect(screen.getByText('1 of 1 done')).toBeInTheDocument()
  })

  it('sets a step aside and brings it back', async () => {
    server.use(
      http.get(BASE, () => HttpResponse.json(track([step({})]))),
      http.put(`${BASE}/steps/mail`, async ({request}) => {
        const {dismissed} = (await request.json()) as {dismissed: boolean}
        return HttpResponse.json(
          track([step({dismissed_at: dismissed ? '2026-10-05T00:00:00Z' : null})]),
        )
      }),
    )
    render(<OnboardingChecklist track="install" />)

    await userEvent.click(
      await screen.findByRole('button', {name: 'Set aside: Set up outgoing mail'}),
    )
    await userEvent.click(
      await screen.findByRole('button', {name: 'Bring back: Set up outgoing mail'}),
    )
    expect(
      await screen.findByRole('button', {name: 'Set aside: Set up outgoing mail'}),
    ).toBeInTheDocument()
  })

  it('starts over only after confirming', async () => {
    let resets = 0
    server.use(
      http.get(BASE, () => HttpResponse.json(track([step({done: true})]))),
      http.delete(BASE, () => {
        resets += 1
        return HttpResponse.json(track([step({})]))
      }),
    )
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<OnboardingChecklist track="install" />)

    await userEvent.click(await screen.findByRole('button', {name: 'Start over'}))
    expect(resets).toBe(0)
    await userEvent.click(screen.getByRole('button', {name: 'Start over'}))
    expect(await screen.findByText('0 of 1 done')).toBeInTheDocument()
    expect(resets).toBe(1)
    confirm.mockRestore()
  })

  it('says so when a change does not save', async () => {
    server.use(
      http.get(BASE, () => HttpResponse.json(track([step({})]))),
      http.put(`${BASE}/steps/mail`, () => new HttpResponse(null, {status: 500})),
    )
    render(<OnboardingChecklist track="install" />)

    await userEvent.click(await screen.findByLabelText('Set up outgoing mail'))
    expect(await screen.findByRole('alert')).toHaveTextContent("That didn't save")
    expect(screen.getByLabelText('Set up outgoing mail')).not.toBeChecked()
  })

  it('says so when the checklist does not load', async () => {
    server.use(http.get(BASE, () => new HttpResponse(null, {status: 404})))
    render(<OnboardingChecklist track="install" />)

    expect(await screen.findByRole('alert')).toHaveTextContent("didn't load")
  })
})
