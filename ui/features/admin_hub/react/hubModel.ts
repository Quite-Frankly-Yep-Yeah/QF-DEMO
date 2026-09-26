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

import {useScope as createI18nScope} from '@canvas/i18n'
import type {HubConfig, Item, Section, SectionKey} from './types'

const I18n = createI18nScope('admin_hub')

// Which section each navigation tab belongs to, by its css class. A tab that
// isn't listed (an external tool, a custom link, a new tab) lands in "More"
// rather than disappearing.
const TAB_SECTION: Record<string, SectionKey> = {
  courses: 'people',
  users: 'people',
  sub_accounts: 'people',
  terms: 'people',
  sis_import: 'people',
  outcomes: 'learning',
  rubrics: 'learning',
  grading_standards: 'learning',
  question_banks: 'learning',
  accessibility: 'learning',
  statistics: 'insights',
  account_reports: 'insights',
  admin_tools: 'insights',
  permissions: 'access',
  authentication: 'access',
  rate_limiting: 'access',
  developer_keys: 'access',
  apps: 'access',
  plugins: 'access',
  jobs: 'access',
  brand_configs: 'appearance',
  account_calendars: 'appearance',
  eportfolio_moderation: 'appearance',
}

export function sectionMeta(): Record<SectionKey, {title: string; description: string}> {
  return {
    people: {
      title: I18n.t('People and courses'),
      description: I18n.t('Courses, people, sub-accounts and terms'),
    },
    learning: {
      title: I18n.t('Learning'),
      description: I18n.t('Outcomes, rubrics, grading and question banks'),
    },
    insights: {
      title: I18n.t('Insights'),
      description: I18n.t('Statistics, reports and admin tools'),
    },
    access: {
      title: I18n.t('Access and security'),
      description: I18n.t('Permissions, sign-in, keys and apps'),
    },
    appearance: {
      title: I18n.t('Appearance'),
      description: I18n.t('Themes and calendars'),
    },
    settings: {
      title: I18n.t('Account settings'),
      description: I18n.t('Every tab of the settings page'),
    },
    self_paced: {
      title: I18n.t('Self-paced'),
      description: I18n.t('Monitoring for self-paced classes'),
    },
    more: {
      title: I18n.t('More'),
      description: I18n.t('Tools and links added to this account'),
    },
  }
}

export const SECTION_ORDER: SectionKey[] = [
  'people',
  'learning',
  'insights',
  'access',
  'appearance',
  'settings',
  'self_paced',
  'more',
]

// The sidebar's Settings tab is the "Account settings" section here, so it
// isn't listed twice.
const SETTINGS_TAB = 'settings'

export function buildSections(config: HubConfig): Section[] {
  const meta = sectionMeta()
  const items: Record<SectionKey, Item[]> = {
    people: [],
    learning: [],
    insights: [],
    access: [],
    appearance: [],
    settings: config.settings_tabs.map(tab => ({
      key: `settings-${tab.id}`,
      label: tab.label,
      path: tab.path,
    })),
    self_paced: config.self_paced.map(link => ({
      key: `self-paced-${link.id}`,
      label: link.label,
      path: link.path,
    })),
    more: [],
  }

  config.tabs.forEach(tab => {
    if (tab.css_class === SETTINGS_TAB) return
    const section = TAB_SECTION[tab.css_class] ?? 'more'
    items[section].push({key: `tab-${tab.css_class}-${tab.path}`, label: tab.label, path: tab.path})
  })

  return SECTION_ORDER.filter(key => items[key].length > 0).map(key => ({
    key,
    ...meta[key],
    items: items[key],
  }))
}

// The sections narrowed to the items whose label contains the query. A
// section whose own title matches keeps all of its items.
export function filterSections(sections: Section[], query: string): Section[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return sections
  return sections.flatMap(section => {
    if (section.title.toLowerCase().includes(needle)) return [section]
    const items = section.items.filter(item => item.label.toLowerCase().includes(needle))
    return items.length > 0 ? [{...section, items}] : []
  })
}
