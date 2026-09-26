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
import SkillsApp, {needsAttention} from '../SkillsApp'
import type {Skill, SkillsConfig, SkillsData} from '../types'

const config: SkillsConfig = {
  course: {id: '10', name: 'Algebra 1', color: null},
  skills_url: '/api/v1/courses/10/self_paced/skills',
  can_add: true,
  classic_url: '/courses/10/outcomes?classic=1',
  home_url: '/courses/10',
}

const skill = (id: string, title: string, counts: Partial<Skill['counts']>, extra = {}): Skill => ({
  id,
  title,
  description: null,
  mastery_points: 3,
  counts: {mastered: 0, almost: 0, building: 0, not_assessed: 0, ...counts},
  aligned: [],
  lessons: [],
  tested_out: 0,
  students: [],
  ...extra,
})

const DATA: SkillsData = {
  course: {id: '10', name: 'Algebra 1'},
  students: 4,
  skills: [
    skill('1', 'Solve one-step equations', {mastered: 3, not_assessed: 1}),
    skill(
      '2',
      'Graph a line',
      {mastered: 1, building: 2, not_assessed: 1},
      {
        description: 'Plot points from a table.',
        aligned: [
          {id: '9', title: 'Graphing quiz', type: 'Assignment', url: '/courses/10/assignments/5'},
        ],
        students: [
          {id: '7', name: 'Jordan Kim', level: 'building', score: 1, assessed_at: null},
          {id: '8', name: 'Maya Lopez', level: 'mastered', score: 3, assessed_at: null},
        ],
      },
    ),
  ],
  summary: {
    totals: {mastered: 4, almost: 0, building: 2, not_assessed: 2},
    mastered_percent: 67,
    needing_attention: 1,
  },
}

let body: SkillsData | (() => Response) = DATA
const posts: unknown[] = []
const server = setupServer(
  http.get(config.skills_url, () =>
    typeof body === 'function' ? body() : HttpResponse.json(body),
  ),
  http.post(config.skills_url, async ({request}) => {
    posts.push(await request.json())
    return HttpResponse.json({id: '3', title: 'New'}, {status: 201})
  }),
)
beforeAll(() => server.listen())
beforeEach(() => {
  body = DATA
  posts.length = 0
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('SkillsApp', () => {
  it('sums up the class and puts the skills that need help first', async () => {
    render(<SkillsApp config={config} />)
    const summary = await screen.findByRole('region', {name: 'Summary'})

    expect(within(summary).getByText('67%')).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', {level: 2}).map(h => h.textContent)
    expect(headings).toEqual(['Graph a line', 'Solve one-step equations'])
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
  })

  it('describes each skill bar in words', async () => {
    render(<SkillsApp config={config} />)

    expect(
      await screen.findByRole('img', {
        name: '1 mastered, 0 almost there, 2 still building, 1 not started',
      }),
    ).toBeInTheDocument()
  })

  it('lists the students, weakest first, each linking to their panel', async () => {
    render(<SkillsApp config={config} />)
    const card = (await screen.findByRole('region', {name: 'Graph a line'})) as HTMLElement
    await userEvent.click(within(card).getByRole('button', {name: 'Show students'}))

    expect(within(card).getByRole('link', {name: 'Jordan Kim'})).toHaveAttribute(
      'href',
      '/self_paced/dashboard?course_id=10&student_id=7',
    )
    expect(within(card).getByText('1 of 3')).toBeInTheDocument()
  })

  it('shows what is aligned to a skill, or that nothing is', async () => {
    render(<SkillsApp config={config} />)
    const graph = (await screen.findByRole('region', {name: 'Graph a line'})) as HTMLElement
    await userEvent.click(within(graph).getByRole('button', {name: 'Practiced in 1 item'}))
    expect(within(graph).getByRole('link', {name: 'Graphing quiz'})).toHaveAttribute(
      'href',
      '/courses/10/assignments/5',
    )

    const equations = screen.getByRole('region', {name: 'Solve one-step equations'})
    await userEvent.click(within(equations).getByRole('button', {name: 'Practiced in 0 items'}))
    expect(within(equations).getByText(/Nothing is aligned/)).toBeInTheDocument()
  })

  it('says which lessons a skill lets students skip', async () => {
    body = {
      ...DATA,
      skills: [
        skill('1', 'Solve one-step equations', {mastered: 3, not_assessed: 1}),
        skill(
          '2',
          'Graph a line',
          {mastered: 1, building: 2, not_assessed: 1},
          {
            lessons: [{id: '31', title: 'Plotting points'}],
            tested_out: 2,
          },
        ),
      ],
    }
    render(<SkillsApp config={config} />)
    const graph = (await screen.findByRole('region', {name: 'Graph a line'})) as HTMLElement

    expect(within(graph).getByTestId('skill-test-out')).toHaveTextContent(
      'Students who master this skill skip 1 lesson. 2 students have tested out.',
    )
    await userEvent.click(within(graph).getByRole('button', {name: 'Practiced in 0 items'}))
    expect(within(graph).getByText('Plotting points')).toBeInTheDocument()
    expect(screen.queryAllByTestId('skill-test-out')).toHaveLength(1)
  })

  it('adds a skill', async () => {
    render(<SkillsApp config={config} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Add a skill'}))
    await userEvent.type(screen.getByLabelText('Skill name'), 'Read a bar graph')
    await userEvent.click(screen.getByRole('button', {name: 'Add skill'}))

    expect(posts).toEqual([{title: 'Read a bar graph', description: ''}])
    expect(await screen.findByText('Added the skill.')).toBeInTheDocument()
  })

  it('hides the add form from people who cannot manage skills', async () => {
    render(<SkillsApp config={{...config, can_add: false}} />)
    await screen.findByRole('region', {name: 'Summary'})

    expect(screen.queryByRole('button', {name: 'Add a skill'})).not.toBeInTheDocument()
  })

  it('explains an empty course', async () => {
    body = {...DATA, skills: [], summary: {...DATA.summary, needing_attention: 0}}
    render(<SkillsApp config={config} />)

    expect(await screen.findByTestId('skills-empty')).toBeInTheDocument()
  })
})

describe('needsAttention', () => {
  it('is true when assessed and fewer than half have mastered', () => {
    expect(needsAttention(skill('a', 'A', {mastered: 1, building: 2}))).toBe(true)
    expect(needsAttention(skill('a', 'A', {mastered: 2, building: 2}))).toBe(false)
  })

  it('is false when nobody has been assessed yet', () => {
    expect(needsAttention(skill('a', 'A', {not_assessed: 4}))).toBe(false)
  })
})
