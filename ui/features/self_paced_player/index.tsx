/*
 * Copyright (C) 2026 - present EXAMPLE contributors
 *
 * This file is part of EXAMPLE LMS, a modified version of Canvas.
 *
 * EXAMPLE LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
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
import PlayerApp from './react/PlayerApp'

ready(() => {
  const container = document.getElementById('self_paced_player')
  const config = (
    window.ENV as {SELF_PACED_PLAYER?: {map_url: string; course_color?: string | null}}
  ).SELF_PACED_PLAYER
  if (!container || !config) return

  render(<PlayerApp config={config} />, container)
})
