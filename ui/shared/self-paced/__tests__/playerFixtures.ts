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

import type {PlayerMap} from '../player'

export const MAP: PlayerMap = {
  course: {id: '4', name: 'Algebra 1'},
  percent_complete: 25,
  requirements_completed: 1,
  requirements_total: 4,
  current_item: {id: '11', title: '1.1 Classwork', url: '/courses/4/modules/items/11'},
  units: [
    {
      id: '1',
      name: 'Unit 1: Functions',
      state: 'started',
      items: [
        {id: '9', title: 'Lesson 1.1', type: 'header'},
        {
          id: '10',
          title: '1.1 Lesson',
          type: 'WikiPage',
          url: '/courses/4/modules/items/10',
          role: 'instruction',
          estimated_minutes: 15,
          requirement: {type: 'must_view'},
          status: 'completed',
        },
        {
          id: '11',
          title: '1.1 Classwork',
          type: 'Quizzes::Quiz',
          url: '/courses/4/modules/items/11',
          role: 'practice',
          requirement: {type: 'must_submit'},
          status: 'current',
        },
        {
          id: '12',
          title: '1.1 Ready, Set, Go',
          type: 'Quizzes::Quiz',
          url: '/courses/4/modules/items/12',
          role: 'check',
          requirement: {type: 'min_percentage', min_percentage: 70},
          status: 'locked',
        },
      ],
    },
    {
      id: '2',
      name: 'Unit 2: Equations',
      state: 'locked',
      items: [
        {
          id: '20',
          title: '2.1 Lesson',
          type: 'WikiPage',
          url: '/courses/4/modules/items/20',
          role: 'instruction',
          requirement: {type: 'must_view'},
          status: 'locked',
        },
      ],
    },
  ],
}
