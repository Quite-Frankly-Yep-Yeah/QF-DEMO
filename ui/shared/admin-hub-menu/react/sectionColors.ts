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

import {PALETTE} from '@canvas/material'
import type {SectionKey} from './types'

// One colour per section, shared by the hub page and the nav popover.
export const SECTION_COLOR: Record<SectionKey, string> = {
  people: PALETTE[0],
  learning: PALETTE[1],
  insights: PALETTE[2],
  access: PALETTE[3],
  appearance: PALETTE[4],
  settings: PALETTE[5],
  self_paced: PALETTE[6],
  more: PALETTE[7],
}
