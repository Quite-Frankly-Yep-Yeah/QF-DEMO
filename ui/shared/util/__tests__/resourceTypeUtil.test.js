/*
 * Copyright (C) 2022 - present Instructure, Inc.
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

// resourceTypeUtil.test.js
import {getResourceTypes, getQuizTypes} from '../resourceTypeUtil'

let FEATURES

describe('resourceTypeUtil', () => {
  beforeEach(() => {
    FEATURES = ENV.FEATURES
  })

  afterEach(() => {
    ENV.FEATURES = FEATURES
  })

  describe('getResourceTypes', () => {
    it('should return RESOURCE_TYPES when new quizzes media type is not enabled', () => {
      const result = getResourceTypes()
      expect(result).toEqual([
        'assignment',
        'audio',
        'discussion_topic',
        'document',
        'image',
        'module',
        'quiz',
        'page',
        'video',
      ])
    })
  })

  describe('getQuizTypes', () => {
    it('should return QUIZ_TYPES when new quizzes media type is not enabled', () => {
      const result = getQuizTypes()
      expect(result).toEqual(['quiz'])
    })
  })
})
