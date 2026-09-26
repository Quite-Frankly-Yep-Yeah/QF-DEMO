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
import CourseHomeApp from '../CourseHomeApp'
import type {CourseHomeConfig} from '../types'

const config: CourseHomeConfig = {
  course: {id: '10', name: 'Algebra 1', course_code: 'ALG1', published: true, color: null},
  checklist: [
    {id: 'units', label: 'Add units and items', done: true, url: '/courses/10/modules'},
    {id: 'students', label: 'Add students', done: false, url: '/courses/10/users'},
  ],
  units: [
    {
      id: '1',
      name: 'Unit 1: Ratios',
      published: true,
      items: 5,
      quizzes: 2,
      unpublished_items: 1,
      url: '/courses/10/modules#module_1',
    },
  ],
  stats: {students: 12, tracked: 12, average_percent: 40, behind: 2, stuck: 0, inactive: 1},
  links: {
    make: [{id: 'quiz', label: 'New quiz', url: '/courses/10/quizzes/new'}],
    manage: [{id: 'modules', label: 'Units', url: '/courses/10/modules'}],
    class: [{id: 'students', label: 'All students', url: '/self_paced/dashboard?course_id=10'}],
  },
  classic_url: '/courses/10?classic=1',
}

describe('CourseHomeApp', () => {
  it('shows the class at a glance with links to the students', () => {
    render(<CourseHomeApp config={config} />)
    const glance = screen.getByRole('region', {name: 'Your class'})

    expect(within(glance).getByText('12')).toBeInTheDocument()
    expect(within(glance).getByRole('meter', {name: 'done on average'})).toHaveAttribute(
      'aria-valuenow',
      '40',
    )
    expect(within(glance).getByRole('link', {name: 'All students'})).toHaveAttribute(
      'href',
      '/self_paced/dashboard?course_id=10',
    )
  })

  it('lists the steps still to do and the units with their problems', () => {
    render(<CourseHomeApp config={config} />)

    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: /Add students/})).toHaveAttribute(
      'href',
      '/courses/10/users',
    )
    const units = screen.getByRole('region', {name: 'Units'})
    expect(within(units).getByText('Unit 1: Ratios')).toBeInTheDocument()
    expect(within(units).getByText('1 not published')).toBeInTheDocument()
  })

  it('drops the checklist once everything is done', () => {
    const done = {...config, checklist: config.checklist.map(step => ({...step, done: true}))}
    render(<CourseHomeApp config={done} />)

    expect(screen.queryByText('Get the class ready')).not.toBeInTheDocument()
  })

  it('says so when the class has no students or units', () => {
    render(<CourseHomeApp config={{...config, stats: null, units: []}} />)

    expect(screen.getByTestId('ch-no-students')).toBeInTheDocument()
    expect(screen.getByTestId('ch-no-units')).toBeInTheDocument()
  })

  it('links to the standard course home', () => {
    render(<CourseHomeApp config={config} />)

    expect(screen.getByRole('link', {name: 'Standard course home'})).toHaveAttribute(
      'href',
      '/courses/10?classic=1',
    )
  })
})
