/*
 * Copyright (C) 2024 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react'
import {render} from '@testing-library/react'
import {DragDropContext} from 'react-dnd'
import ReactDndTestBackend from 'react-dnd-test-backend'
import {setupServer} from 'msw/node'

import DashboardCard from '../DashboardCard'
import getDroppableDashboardCardBox from '../getDroppableDashboardCardBox'
import CourseActivitySummaryStore from '../CourseActivitySummaryStore'

const server = setupServer()

describe('DashboardCardBox', () => {
  let props
  const defaultProps = {
    cardComponent: DashboardCard,
    courseCards: [
      {
        id: '1',
        isFavorited: true,
        courseName: 'Bio 101',
        assetString: 'course_1',
      },
      {
        id: '2',
        isFavorited: true,
        courseName: 'Philosophy 201',
        assetString: 'course_1',
      },
    ],
  }

  beforeAll(() => server.listen())
  afterAll(() => server.close())

  beforeEach(() => {
    props = {...defaultProps}

    vi.spyOn(CourseActivitySummaryStore, 'getStateForCourse').mockReturnValue({})
  })

  afterEach(() => {
    server.resetHandlers()
    vi.clearAllMocks()
  })

  const renderComponent = () => {
    const Box = getDroppableDashboardCardBox(DragDropContext(ReactDndTestBackend))
    return {
      ...render(<Box connectDropTarget={el => el} ref={() => {}} {...props} />),
      Box,
    }
  }

  describe('rendering', () => {
    it('renders dashboard cards for each provided courseCard', () => {
      renderComponent()
      const cards = document.querySelectorAll('.ic-DashboardCard')
      expect(cards).toHaveLength(props.courseCards.length)
    })

    it('renders headers for both published/unpublished courses in split view', () => {
      props.showSplitDashboardView = true
      renderComponent()
      const headers = document.querySelectorAll('.ic-DashboardCard__box__header')
      expect(headers).toHaveLength(2)
    })

    it('correctly splits course cards into published and unpublished in split view', () => {
      props.courseCards = [
        {...props.courseCards[0], published: false},
        {...props.courseCards[1], published: true},
      ]
      props.showSplitDashboardView = true
      renderComponent()
      const headers = document.querySelectorAll('.ic-DashboardCard__box__header')
      expect(headers[0].textContent).toContain('Published Courses (1)')
      expect(headers[1].textContent).toContain('Unpublished Courses (1)')
    })

    it('correctly renders empty headers in split view', () => {
      props.courseCards = []
      props.showSplitDashboardView = true
      renderComponent()
      const dashboardBox = document.querySelector('.unpublished_courses_redesign')
      expect(dashboardBox.textContent).toContain('No courses to display')
    })
  })
})
