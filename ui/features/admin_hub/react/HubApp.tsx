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

import React, {useMemo, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {
  IconAdminLine,
  IconAnalyticsLine,
  IconClockLine,
  IconFolderLine,
  IconLockLine,
  IconOutcomesLine,
  IconPaintLine,
  IconSettingsLine,
  IconUserLine,
} from '@instructure/ui-icons'
import {APP_BAR, ELEVATION, INK, ink, PALETTE, ROBOTO, SURFACE, tint} from './material'
import {buildSections, filterSections} from './hubModel'
import type {HubConfig, Section, SectionKey} from './types'

const I18n = createI18nScope('admin_hub')

const SECTION_STYLE: Record<SectionKey, {color: string; Icon: typeof IconUserLine}> = {
  people: {color: PALETTE[0], Icon: IconUserLine},
  learning: {color: PALETTE[1], Icon: IconOutcomesLine},
  insights: {color: PALETTE[2], Icon: IconAnalyticsLine},
  access: {color: PALETTE[3], Icon: IconLockLine},
  appearance: {color: PALETTE[4], Icon: IconPaintLine},
  settings: {color: PALETTE[5], Icon: IconSettingsLine},
  self_paced: {color: PALETTE[6], Icon: IconClockLine},
  more: {color: PALETTE[7], Icon: IconFolderLine},
}

const STYLES = `.ah-link { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 0 20px; color: ${INK.primary}; text-decoration: none; font-size: 0.9375rem; }
.ah-link:hover { background: rgba(0,0,0,0.06); }
.ah-link:focus-visible { outline: 2px solid #2B7ABC; outline-offset: -2px; background: rgba(0,0,0,0.06); }
.ah-card { transition: box-shadow 0.2s; }
.ah-card:hover { box-shadow: ${ELEVATION[8]} !important; }
.ah-search:focus { border-bottom: 2px solid #fff !important; padding-bottom: 7px !important; }
@media (prefers-reduced-motion: reduce) { .ah-card { transition: none; } }`

function SectionCard({section}: {section: Section}) {
  const {color, Icon} = SECTION_STYLE[section.key]
  const headingId = `ah-section-${section.key}`
  return (
    <section
      aria-labelledby={headingId}
      className="ah-card"
      style={{background: '#F5F5F5', borderRadius: 2, boxShadow: ELEVATION[2], overflow: 'hidden'}}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          padding: '16px 20px',
          background: ink(color),
          color: '#fff',
        }}
      >
        <span aria-hidden="true" style={{display: 'inline-flex', fontSize: '1.5rem'}}>
          <Icon color="primary-inverse" />
        </span>
        <div>
          <h2
            id={headingId}
            style={{
              margin: 0,
              fontFamily: ROBOTO,
              fontSize: '1.25rem',
              fontWeight: 500,
              color: '#fff',
            }}
          >
            {section.title}
          </h2>
          <div style={{fontSize: '0.8125rem', opacity: 0.88}}>{section.description}</div>
        </div>
      </div>
      <ul style={{listStyle: 'none', margin: 0, padding: '8px 0'}}>
        {section.items.map(item => (
          <li key={item.key}>
            <a className="ah-link" href={item.path}>
              <span>{item.label}</span>
              <span aria-hidden="true" style={{color: tint('#000000', 0.38)}}>
                ›
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

// The administration hub: a card per area of the account, each listing the
// pages the admin can open, with a search over all of them.
export default function HubApp({config}: {config: HubConfig}) {
  const [query, setQuery] = useState('')
  const sections = useMemo(() => buildSections(config), [config])
  const shown = useMemo(() => filterSections(sections, query), [sections, query])
  const count = shown.reduce((sum, section) => sum + section.items.length, 0)

  return (
    <div style={{fontFamily: ROBOTO, background: SURFACE, minHeight: '100%', paddingBottom: 48}}>
      <style>{STYLES}</style>
      <header
        style={{
          background: ink(APP_BAR),
          color: '#fff',
          boxShadow: ELEVATION[4],
          borderRadius: '2px 2px 0 0',
        }}
      >
        <div aria-hidden="true" style={{display: 'flex', height: 6}}>
          {PALETTE.map(color => (
            <span key={color} style={{flex: 1, background: color}} />
          ))}
        </div>
        <div style={{padding: '32px 32px 40px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, opacity: 0.88}}>
            <IconAdminLine color="primary-inverse" />
            {config.account.name}
          </div>
          <h1
            style={{
              margin: '4px 0 24px',
              fontFamily: ROBOTO,
              fontWeight: 300,
              fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.5px',
              color: '#fff',
            }}
          >
            {I18n.t('Administration')}
          </h1>
          <label style={{display: 'block', maxWidth: 480}}>
            <span style={{display: 'block', fontSize: '0.75rem', opacity: 0.88, marginBottom: 4}}>
              {I18n.t('Find a setting or page')}
            </span>
            <input
              type="search"
              className="ah-search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 0',
                fontFamily: ROBOTO,
                fontSize: '1rem',
                color: '#fff',
                background: 'transparent',
                border: 0,
                borderBottom: '1px solid rgba(255,255,255,0.7)',
                borderRadius: 0,
                outline: 'none',
              }}
            />
          </label>
        </div>
      </header>

      <div role="status" aria-live="polite" style={{position: 'absolute', left: -9999}}>
        {query.trim() ? I18n.t({one: '1 result', other: '%{count} results'}, {count}) : ''}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24,
          alignItems: 'start',
          padding: '24px 32px 0',
        }}
      >
        {shown.map(section => (
          <SectionCard key={section.key} section={section} />
        ))}
      </div>
      {shown.length === 0 && (
        <p style={{padding: '32px', color: INK.secondary}}>
          {I18n.t('Nothing matches "%{query}".', {query: query.trim()})}
        </p>
      )}
    </div>
  )
}
