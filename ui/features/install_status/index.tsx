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
import InstallStatusApp from './react/InstallStatusApp'

ready(() => {
  const container = document.getElementById('install_status_app')
  const config = (window.ENV as {INSTALL_STATUS?: {track: string}}).INSTALL_STATUS
  if (!container || !config) return

  render(<InstallStatusApp track={config.track} />, container)
})
