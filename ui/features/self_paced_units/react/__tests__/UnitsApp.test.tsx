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
import {render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import UnitsApp from '../UnitsApp'
import type {Item, Setup, UnitsConfig} from '../types'

const config: UnitsConfig = {
  course: {id: '10', name: 'Algebra 1', color: null},
  setup_url: '/api/v1/courses/10/self_paced/setup',
  classic_url: '/courses/10/modules?classic=1',
  home_url: '/courses/10',
}

const item = (id: string, title: string, extra: Partial<Item> = {}): Item => ({
  id,
  title,
  type: 'WikiPage',
  published: true,
  url: `/courses/10/modules/items/${id}`,
  role: 'instruction',
  estimated_minutes: null,
  suggested_minutes: 5,
  mastery_threshold: null,
  watch_fraction: null,
  max_attempts: null,
  retake_review: false,
  skill_id: null,
  ...extra,
})

let setup: Setup
const calls: Array<{method: string; url: string; body: unknown}> = []

const server = setupServer(
  http.get(config.setup_url, () => HttpResponse.json(setup)),
  http.put(config.setup_url, async ({request}) => {
    calls.push({method: 'PUT', url: request.url, body: await request.json()})
    return HttpResponse.json(setup)
  }),
  http.all('/api/v1/courses/10/modules*', async ({request}) => {
    calls.push({
      method: request.method,
      url: new URL(request.url).pathname,
      body: await request.json().catch(() => null),
    })
    return HttpResponse.json({})
  }),
)
beforeAll(() => server.listen())
beforeEach(() => {
  calls.length = 0
  setup = {
    mastery_threshold: 70,
    provisional_checks: false,
    skills: [{id: '5', title: 'Graph a line'}],
    modules: [
      {
        id: '1',
        name: 'Unit 1: Ratios',
        published: true,
        items: [
          item('11', 'Intro'),
          item('12', 'Check 1', {type: 'Quizzes::Quiz', role: 'check', published: false}),
        ],
      },
      {id: '2', name: 'Unit 2', published: false, items: []},
    ],
  }
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('UnitsApp', () => {
  it('lists the units and items with their role, minutes and status', async () => {
    render(<UnitsApp config={config} />)
    const unit = (await screen.findByRole('region', {name: 'Unit 1: Ratios'})) as HTMLElement

    expect(within(unit).getByRole('link', {name: 'Intro'})).toHaveAttribute(
      'href',
      '/courses/10/modules/items/11',
    )
    expect(within(unit).getByRole('switch', {name: 'Published: Check 1'})).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(within(unit).getByLabelText('What Check 1 is for')).toHaveValue('check')
    expect(screen.getByText(/2 items · 10 min/)).toBeInTheDocument()
    expect(screen.getByText(/Not published/, {selector: 'div'})).toBeInTheDocument()
  })

  it('saves a changed role through the setup API', async () => {
    render(<UnitsApp config={config} />)
    await userEvent.selectOptions(await screen.findByLabelText('What Intro is for'), 'practice')

    const save = calls.find(
      c => c.method === 'PUT' && (c.body as {items: Array<{id: string}>}).items[0]?.id === '11',
    )
    expect(save?.body).toMatchObject({items: [{id: '11', role: 'practice'}]})
  })

  it('sets the skill a lesson teaches, which the setup API saves', async () => {
    render(<UnitsApp config={config} />)
    await userEvent.selectOptions(
      await screen.findByLabelText('Skill Intro teaches, skipped when a student masters it'),
      '5',
    )

    const save = calls.find(
      c =>
        c.method === 'PUT' &&
        (c.body as {items: Array<{skill_id?: string}>}).items[0]?.skill_id === '5',
    )
    expect(save?.body).toMatchObject({items: [{id: '11', skill_id: '5'}]})
  })

  it('offers no skill choice for a check', async () => {
    render(<UnitsApp config={config} />)
    await screen.findByRole('region', {name: 'Unit 1: Ratios'})

    expect(screen.queryByLabelText(/Skill Check 1 teaches/)).not.toBeInTheDocument()
  })

  it('publishes an item and moves a unit down', async () => {
    render(<UnitsApp config={config} />)
    await userEvent.click(await screen.findByRole('switch', {name: 'Published: Check 1'}))
    await userEvent.click(screen.getByRole('button', {name: 'Move Unit 1: Ratios down'}))

    expect(calls).toContainEqual(
      expect.objectContaining({
        method: 'PUT',
        url: '/api/v1/courses/10/modules/1/items/12',
        body: {module_item: {published: true}},
      }),
    )
    expect(calls).toContainEqual(
      expect.objectContaining({
        method: 'PUT',
        url: '/api/v1/courses/10/modules/1',
        body: {module: {position: 2}},
      }),
    )
  })

  it('adds a unit', async () => {
    render(<UnitsApp config={config} />)
    await userEvent.type(await screen.findByLabelText('Name of a new unit'), 'Unit 3')
    await userEvent.click(screen.getByRole('button', {name: 'Add unit'}))

    expect(calls).toContainEqual(
      expect.objectContaining({
        method: 'POST',
        url: '/api/v1/courses/10/modules',
        body: {module: {name: 'Unit 3'}},
      }),
    )
    expect(await screen.findByText('Added Unit 3.')).toBeInTheDocument()
  })

  it('says so when there are no units', async () => {
    setup = {...setup, modules: []}
    render(<UnitsApp config={config} />)

    expect(await screen.findByTestId('units-empty')).toBeInTheDocument()
  })
})
