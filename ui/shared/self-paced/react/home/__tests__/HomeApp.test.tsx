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
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import HomeApp, {greeting} from '../HomeApp'
import {classColors, contrast, ink, PALETTE} from '../../../material'
import type {Home, HomeCourse} from '../types'

const config = {home_url: '/api/v1/self_paced/home', classic_url: '/?classic=1'}
const NOW = new Date(2026, 8, 24, 9, 30)

function course(overrides: Partial<HomeCourse> & {id: string; name: string}): HomeCourse {
  return {
    course_code: 'CODE',
    color: null,
    image_url: null,
    url: `/courses/${overrides.id}/player`,
    percent_complete: 40,
    requirements_completed: 4,
    requirements_total: 10,
    score: null,
    last_active_at: null,
    continue: null,
    pace: null,
    ...overrides,
  }
}

const HOME: Home = {
  student: {id: '1', name: 'Maya Lopez', short_name: 'Maya'},
  courses: [
    course({
      id: '10',
      name: 'Algebra 1',
      percent_complete: 62,
      score: 88.4,
      continue: {
        title: '2.3 Ready, Set, Go',
        module: 'Unit 2',
        url: '/courses/10/modules/items/55',
      },
      pace: {
        days_ahead: -2,
        finished: false,
        target_date: '2027-06-04',
        today: {done: 1, total: 3, minutes: 45},
        week: {done: 2, total: 9},
      },
    }),
    course({id: '9', name: 'Math 1', percent_complete: 10}),
  ],
  resume_course_id: '10',
  due_soon: [
    {
      id: '7',
      title: '2.3 Check',
      course_id: '10',
      due_at: '2026-09-25T18:00:00Z',
      url: '/courses/10/assignments/7',
    },
  ],
  feedback: [
    {
      id: '3',
      title: '1.4 Check',
      course_id: '10',
      score: 8,
      points_possible: 10,
      graded_at: '2026-09-22T12:00:00Z',
      url: '/courses/10/assignments/3/submissions/1',
    },
  ],
  other_courses: [{id: '11', name: 'Art', course_code: 'ART', url: '/courses/11', color: null}],
}

const server = setupServer(
  http.get('/api/v1/self_paced/home', () => HttpResponse.json(HOME)),
  http.get('/api/v1/users/self/colors', () => HttpResponse.json({custom_colors: {}})),
)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('HomeApp', () => {
  it('greets the student and sums up today', async () => {
    render(<HomeApp config={config} now={NOW} />)

    expect(
      await screen.findByRole('heading', {name: 'Good morning, Maya', level: 1}),
    ).toBeInTheDocument()
    expect(screen.getByText('1 of 3 items planned for today are done.')).toBeInTheDocument()
  })

  it('tells a student with no classes so, in the raised card', async () => {
    server.use(
      http.get('/api/v1/self_paced/home', () =>
        HttpResponse.json({
          ...HOME,
          courses: [],
          resume_course_id: null,
          due_soon: [],
          feedback: [],
          other_courses: [],
        }),
      ),
    )
    render(<HomeApp config={config} now={NOW} />)
    const card = await screen.findByTestId('sp-home-empty')

    expect(
      within(card).getByRole('heading', {name: "You aren't enrolled in any classes yet"}),
    ).toBeInTheDocument()
    expect(screen.getByText('Welcome. Your classes will show up here.')).toBeInTheDocument()
  })

  it('picks up where the student left off', async () => {
    render(<HomeApp config={config} now={NOW} />)
    const hero = (await screen.findByRole('heading', {name: 'Pick up where you left off'})).closest(
      'section',
    ) as HTMLElement

    expect(within(hero).getByText('2.3 Ready, Set, Go')).toBeInTheDocument()
    expect(within(hero).getByRole('link', {name: 'Continue'})).toHaveAttribute(
      'href',
      '/courses/10/modules/items/55',
    )
  })

  it('shows a card per class with progress, pace, grade and a way back in', async () => {
    render(<HomeApp config={config} now={NOW} />)
    const card = (await screen.findByRole('heading', {name: 'Algebra 1', level: 2})).closest(
      'section',
    ) as HTMLElement

    expect(within(card).getByRole('meter', {name: 'Progress in Algebra 1'})).toHaveAttribute(
      'aria-valuenow',
      '62',
    )
    expect(within(card).getByText('Grade 88%')).toBeInTheDocument()
    expect(
      within(card).getByText("Today's goal: 1 of 3 items (45 min planned)"),
    ).toBeInTheDocument()
    expect(within(card).getByRole('link', {name: 'Continue Algebra 1'})).toHaveAttribute(
      'href',
      '/courses/10/modules/items/55',
    )
  })

  it('lists work due this week, recent feedback and other classes', async () => {
    render(<HomeApp config={config} now={NOW} />)

    expect(await screen.findByRole('link', {name: '2.3 Check'})).toHaveAttribute(
      'href',
      '/courses/10/assignments/7',
    )
    expect(screen.getByText('Algebra 1: 8 out of 10')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Art'})).toHaveAttribute('href', '/courses/11')
  })

  it('offers the classic dashboard when the page fails to load', async () => {
    server.use(http.get('/api/v1/self_paced/home', () => new HttpResponse(null, {status: 500})))
    render(<HomeApp config={config} now={NOW} />)

    expect(await screen.findByRole('link', {name: 'Open the classic dashboard'})).toHaveAttribute(
      'href',
      '/?classic=1',
    )
  })
})

describe('greeting', () => {
  it('follows the time of day', () => {
    expect(greeting('Maya', new Date(2026, 8, 24, 15))).toBe('Good afternoon, Maya')
    expect(greeting('Maya', new Date(2026, 8, 24, 20))).toBe('Good evening, Maya')
  })
})

describe('classColors', () => {
  it("prefers the student's color, then the course's, then the palette", () => {
    const colors = classColors(
      [
        {id: '1', color: null},
        {id: '2', color: '#123456'},
        {id: '3', color: null},
      ],
      {course_3: '#abcdef'},
    )

    expect(colors).toEqual({'1': PALETTE[0], '2': '#123456', '3': '#abcdef'})
  })

  it('darkens every palette color enough for white text', () => {
    PALETTE.forEach(color => expect(contrast(ink(color), '#ffffff')).toBeGreaterThanOrEqual(4.5))
  })
})
