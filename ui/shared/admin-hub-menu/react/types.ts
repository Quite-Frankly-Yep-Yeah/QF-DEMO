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

export type HubTab = {css_class: string; path: string; label: string}
export type HubLink = {id: string; path: string; label: string}

export type HubConfig = {
  account: {id: string; name: string}
  tabs: HubTab[]
  settings_tabs: HubLink[]
  self_paced: HubLink[]
}

export type SectionKey =
  | 'people'
  | 'learning'
  | 'insights'
  | 'access'
  | 'appearance'
  | 'settings'
  | 'self_paced'
  | 'more'

export type Item = {key: string; label: string; path: string}
export type Section = {key: SectionKey; title: string; description: string; items: Item[]}
