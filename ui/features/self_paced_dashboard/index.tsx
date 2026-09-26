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
import {render} from '@canvas/react'
import ready from '@instructure/ready'
import CourseApp from './react/CourseApp'
import DashboardApp from './react/DashboardApp'
import type {CourseConfig, DashboardConfig} from './react/types'

ready(() => {
  const container = document.getElementById('self_paced_dashboard')
  const env = window.ENV as {
    SELF_PACED_DASHBOARD?: DashboardConfig
    SELF_PACED_COURSE?: CourseConfig
  }
  const config = env.SELF_PACED_DASHBOARD
  if (!container || !config) return

  // the same app serves the page for one course
  if (env.SELF_PACED_COURSE) {
    render(<CourseApp config={config} course={env.SELF_PACED_COURSE} />, container)
  } else {
    render(<DashboardApp config={config} />, container)
  }
})
