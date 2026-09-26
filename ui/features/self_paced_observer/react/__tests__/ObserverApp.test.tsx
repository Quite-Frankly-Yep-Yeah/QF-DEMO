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
import ObserverApp, {agoText, paceText} from '../ObserverApp'
import type {ObservedStudent, ObserverConfig, ObserverData} from '../types'

const config: ObserverConfig = {data_url: '/api/v1/self_paced/observer', classic_url: '/?classic=1'}
const NOW = new Date('2026-09-25T15:00:00Z')

const student = (
  id: string,
  name: string,
  extra: Partial<ObservedStudent> = {},
): ObservedStudent => ({
  id,
  name,
  short_name: name.split(' ')[0],
  courses: [
    {
      id: '10',
      name: 'Algebra 1',
      course_code: 'ALG1',
      color: null,
      percent_complete: 40,
      requirements_completed: 8,
      requirements_total: 20,
      last_active_at: '2026-09-22T15:00:00Z',
      pace: {days_behind: 2, target_date: '2026-11-13', expected_percent: 55},
    },
  ],
  time: {
    daily: [0, 10, 20, 0, 30, 0, 15].map((minutes, i) => ({day: `2026-09-${19 + i}`, minutes})),
    week_minutes: 75,
    previous_week_minutes: 40,
  },
  grades: [
    {
      id: '1',
      title: 'Ratios check',
      course: 'Algebra 1',
      score: 8,
      points_possible: 10,
      graded_at: '2026-09-24T12:00:00Z',
    },
  ],
  alerts: [],
  ...extra,
})

let body: ObserverData
const server = setupServer(http.get(config.data_url, () => HttpResponse.json(body)))
beforeAll(() => server.listen())
beforeEach(() => {
  body = {observer: {id: '1', name: 'Pat Kim'}, students: [student('7', 'Maya Lopez')]}
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('ObserverApp', () => {
  it('shows progress, pace and when the student was last active for each class', async () => {
    render(<ObserverApp config={config} now={NOW} />)
    const course = await screen.findByRole('region', {name: 'Algebra 1'})

    expect(within(course).getByText('40%')).toBeInTheDocument()
    expect(within(course).getByText('8 of 20 steps')).toBeInTheDocument()
    expect(within(course).getByText('2 days behind')).toBeInTheDocument()
    expect(within(course).getByText('Last active 3 days ago')).toBeInTheDocument()
    expect(within(course).getByRole('meter', {name: 'Progress in Algebra 1'})).toHaveAttribute(
      'aria-valuenow',
      '40',
    )
  })

  it('compares this week with last', async () => {
    render(<ObserverApp config={config} now={NOW} />)

    expect(await screen.findByText('75 min')).toBeInTheDocument()
    expect(screen.getByText('35 min more than last week')).toBeInTheDocument()
  })

  it('lists recent posted grades', async () => {
    render(<ObserverApp config={config} now={NOW} />)
    const grades = await screen.findByRole('region', {name: 'Recent grades'})

    expect(within(grades).getByText('Ratios check')).toBeInTheDocument()
    expect(within(grades).getByText('8 of 10')).toBeInTheDocument()
  })

  it('says so when no grades are posted', async () => {
    body = {...body, students: [student('7', 'Maya Lopez', {grades: []})]}
    render(<ObserverApp config={config} now={NOW} />)

    expect(await screen.findByTestId('observer-no-grades')).toBeInTheDocument()
  })

  it('puts open alerts first', async () => {
    body = {
      ...body,
      students: [
        student('7', 'Maya Lopez', {
          alerts: [
            {
              id: '3',
              kind: 'behind',
              description: '4 days behind their pace',
              course: 'Algebra 1',
              opened_at: '2026-09-24T12:00:00Z',
            },
          ],
        }),
      ],
    }
    render(<ObserverApp config={config} now={NOW} />)
    const alerts = await screen.findByRole('region', {name: 'Worth a conversation'})

    expect(within(alerts).getByText('4 days behind their pace')).toBeInTheDocument()
  })

  it('lets a parent with several students switch between them', async () => {
    body = {
      ...body,
      students: [student('7', 'Maya Lopez'), student('8', 'Jordan Kim', {courses: []})],
    }
    render(<ObserverApp config={config} now={NOW} />)
    expect(await screen.findByRole('heading', {level: 2, name: 'Maya Lopez'})).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', {name: 'Jordan'}))

    expect(screen.getByRole('heading', {level: 2, name: 'Jordan Kim'})).toBeInTheDocument()
    expect(screen.queryByRole('region', {name: 'Algebra 1'})).not.toBeInTheDocument()
  })

  it('explains an account with no linked students', async () => {
    body = {...body, students: []}
    render(<ObserverApp config={config} now={NOW} />)

    expect(await screen.findByTestId('observer-empty')).toBeInTheDocument()
  })

  it('offers the classic dashboard when the page fails to load', async () => {
    server.use(http.get(config.data_url, () => new HttpResponse(null, {status: 500})))
    render(<ObserverApp config={config} now={NOW} />)

    expect(await screen.findByRole('link', {name: 'Open the classic dashboard'})).toHaveAttribute(
      'href',
      '/?classic=1',
    )
  })
})

describe('helpers', () => {
  it('words how long ago someone was active', () => {
    expect(agoText(null, NOW)).toBe('Not started yet')
    expect(agoText('2026-09-25T09:00:00Z', NOW)).toBe('Active today')
    expect(agoText('2026-09-24T09:00:00Z', NOW)).toBe('Last active 1 day ago')
  })

  it('words pace, and stays quiet for an unpaced course', () => {
    expect(paceText(null)).toBeNull()
    expect(paceText({days_behind: 0, target_date: null, expected_percent: null})?.label).toBe(
      'On track',
    )
    expect(paceText({days_behind: -2, target_date: null, expected_percent: null})?.label).toBe(
      '2 days ahead',
    )
    expect(paceText({days_behind: 5, target_date: null, expected_percent: null})?.color).toBe(
      '#C62828',
    )
  })
})

describe('the page in the student home look', () => {
  it('greets the parent by first name and says who they are following', async () => {
    render(<ObserverApp config={config} now={new Date('2026-09-25T09:00:00')} />)

    expect(
      await screen.findByRole('heading', {level: 1, name: 'Good morning, Pat'}),
    ).toBeInTheDocument()
    expect(screen.getByText("Here's how Maya is doing.")).toBeInTheDocument()
  })
})
