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

import {buildSections, filterSections} from '../hubModel'
import type {HubConfig} from '../types'

const config: HubConfig = {
  account: {id: '1', name: 'Northside High'},
  tabs: [
    {css_class: 'courses', path: '/accounts/1', label: 'Courses'},
    {css_class: 'users', path: '/accounts/1/users', label: 'People'},
    {css_class: 'permissions', path: '/accounts/1/permissions', label: 'Permissions'},
    {css_class: 'my-tool', path: '/accounts/1/external_tools/9', label: 'District Tool'},
    {css_class: 'settings', path: '/accounts/1/settings', label: 'Settings'},
  ],
  settings_tabs: [
    {id: 'quotas', label: 'Quotas', path: '/accounts/1/settings#tab-quotas'},
    {id: 'features', label: 'Feature options', path: '/accounts/1/settings#tab-features'},
  ],
  self_paced: [{id: 'dashboard', label: 'Teacher dashboard', path: '/self_paced/dashboard'}],
}

describe('buildSections', () => {
  it('groups navigation tabs and keeps the section order', () => {
    expect(buildSections(config).map(s => s.key)).toEqual([
      'people',
      'access',
      'settings',
      'self_paced',
      'more',
    ])
  })

  it('puts a tab it does not know in More instead of dropping it', () => {
    const more = buildSections(config).find(s => s.key === 'more')
    expect(more?.items.map(i => i.label)).toEqual(['District Tool'])
  })

  it('lists the settings tabs once, not the sidebar Settings tab', () => {
    const labels = buildSections(config).flatMap(s => s.items.map(i => i.label))
    expect(labels).not.toContain('Settings')
    expect(labels).toContain('Quotas')
  })

  it('puts the AI settings tab in Access and security', () => {
    const withAi: HubConfig = {
      ...config,
      tabs: [
        ...config.tabs,
        {css_class: 'ai_settings', path: '/accounts/1/ai_settings', label: 'AI settings'},
      ],
    }
    const access = buildSections(withAi).find(s => s.key === 'access')
    expect(access?.items.map(i => i.label)).toContain('AI settings')
    expect(
      buildSections(withAi)
        .find(s => s.key === 'more')
        ?.items.map(i => i.label),
    ).not.toContain('AI settings')
  })

  it('leaves out a section with nothing in it', () => {
    const sections = buildSections({...config, self_paced: []})
    expect(sections.map(s => s.key)).not.toContain('self_paced')
  })
})

describe('filterSections', () => {
  const sections = buildSections(config)

  it('returns everything for a blank query', () => {
    expect(filterSections(sections, '  ')).toBe(sections)
  })

  it('keeps only the matching items, case-insensitively', () => {
    const result = filterSections(sections, 'QUOTA')
    expect(result.map(s => s.key)).toEqual(['settings'])
    expect(result[0].items.map(i => i.label)).toEqual(['Quotas'])
  })

  it('keeps a whole section when its title matches', () => {
    const result = filterSections(sections, 'self-paced')
    expect(result[0].items).toHaveLength(1)
  })

  it('returns nothing when nothing matches', () => {
    expect(filterSections(sections, 'zzz')).toEqual([])
  })
})
