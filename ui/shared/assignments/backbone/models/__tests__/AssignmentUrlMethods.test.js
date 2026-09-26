/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

import fakeENV from '@canvas/test-utils/fakeENV'
import Assignment from '../Assignment'

describe('Assignment URL Methods', () => {
  beforeEach(() => {
    fakeENV.setup()
  })

  afterEach(() => {
    fakeENV.teardown()
  })

  test('htmlUrl is the assignment html_url', () => {
    const assignment = new Assignment({html_url: 'https://example.com/assignments/1'})
    expect(assignment.htmlUrl()).toBe('https://example.com/assignments/1')
  })

  test('htmlEditUrl adds the edit path', () => {
    const assignment = new Assignment({html_url: 'https://example.com/assignments/1'})
    expect(assignment.htmlEditUrl()).toBe('https://example.com/assignments/1/edit')
  })

  test('htmlBuildUrl is the assignment html_url for a regular assignment', () => {
    const assignment = new Assignment({html_url: 'https://example.com/assignments/1'})
    expect(assignment.htmlBuildUrl()).toBe('https://example.com/assignments/1')
  })
})
