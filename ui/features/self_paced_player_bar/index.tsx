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
import PlayerBar, {type PlayerBarConfig} from './react/PlayerBar'
import {startVideoTracking} from '@canvas/self-paced/videoTracker'

// In course player courses the player bar takes over from the module footer.
const HIDE_MODULE_FOOTER = `
  body.self-paced-player #sequence_footer,
  body.self-paced-player #module_sequence_footer,
  body.self-paced-player .module-sequence-footer { display: none !important; }
`

ready(() => {
  const config = (window.ENV as {SELF_PACED_PLAYER_BAR?: PlayerBarConfig}).SELF_PACED_PLAYER_BAR
  const content = document.getElementById('content')
  if (!config || !content) return

  const style = document.createElement('style')
  style.textContent = HIDE_MODULE_FOOTER
  document.head.appendChild(style)

  const mount = document.createElement('div')
  mount.id = 'self-paced-player-bar'
  content.prepend(mount)
  render(<PlayerBar config={config} />, mount)

  // items that must be watched report how much of their video has played
  if (config.watch_fraction && config.video_progress_url && config.module_item_id) {
    startVideoTracking(
      {url: config.video_progress_url, moduleItemId: config.module_item_id},
      content,
    )
  }
})
