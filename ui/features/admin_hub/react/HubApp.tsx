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

import React, {useMemo} from 'react'
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
import {
  DIVIDER,
  ELEVATION,
  INK,
  ink,
  ON_APP_BAR,
  PALETTE,
  PAPER,
  ROBOTO,
  SUBTLE,
  SURFACE,
  tint,
} from '@canvas/material'
import {useMaterialPage} from '@canvas/material/useMaterialPage'
import {useThemeTokens} from '@canvas/material/useThemeTokens'
import {SECTION_COLOR} from '@canvas/admin-hub-menu/react/sectionColors'
import {buildSections} from '@canvas/admin-hub-menu/react/hubModel'
import type {HubConfig, Section, SectionKey} from '@canvas/admin-hub-menu/react/types'

const I18n = createI18nScope('admin_hub')

const SECTION_STYLE: Record<
  SectionKey,
  {color: string; Icon: React.ComponentType<{color?: string}>}
> = {
  people: {color: SECTION_COLOR.people, Icon: IconUserLine},
  learning: {color: SECTION_COLOR.learning, Icon: IconOutcomesLine},
  insights: {color: SECTION_COLOR.insights, Icon: IconAnalyticsLine},
  access: {color: SECTION_COLOR.access, Icon: IconLockLine},
  appearance: {color: SECTION_COLOR.appearance, Icon: IconPaintLine},
  settings: {color: SECTION_COLOR.settings, Icon: IconSettingsLine},
  self_paced: {color: SECTION_COLOR.self_paced, Icon: IconClockLine},
  more: {color: SECTION_COLOR.more, Icon: IconFolderLine},
}

const styles = (
  appBar: string,
) => `.ah-root { font-family: ${ROBOTO}; background: ${SURFACE}; min-height: 100%; padding-bottom: 48px; }
.ah-header { background: ${appBar}; color: ${ON_APP_BAR}; box-shadow: ${ELEVATION[4]}; }
.ah-header__stripe { display: flex; height: 6px; }
.ah-header__content { max-width: 1280px; box-sizing: border-box; margin: 0 auto; padding: 28px 32px 32px; }
.ah-header__account { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; opacity: 0.92; }
.ah-header h1 { margin: 6px 0 20px; font-size: clamp(2rem, 4vw, 2.75rem); font-weight: 400; line-height: 1.15; letter-spacing: -0.25px; color: ${ON_APP_BAR}; }
.ah-main { max-width: 1280px; box-sizing: border-box; margin: 0 auto; padding: 24px 32px 0; }
.ah-summary { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 20px; margin-bottom: 16px; color: ${INK.secondary}; font-size: 0.875rem; }
.ah-jump-links { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
.ah-jump-link { color: ${INK.primary}; text-decoration: none; font-size: 0.875rem; border: 1px solid ${DIVIDER}; border-radius: 16px; padding: 6px 12px; background: ${PAPER}; }
.ah-jump-link:hover { background: ${SUBTLE}; border-color: ${INK.secondary}; }
.ah-jump-link:focus-visible { outline: 2px solid #2B7ABC; outline-offset: 2px; }
.ah-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 20px; align-items: start; }
.ah-card { overflow: hidden; border-top: 4px solid; border-radius: 4px; background: ${PAPER}; box-shadow: ${ELEVATION[2]}; transition: box-shadow 0.2s; scroll-margin-top: 16px; }
.ah-card:hover { box-shadow: ${ELEVATION[4]}; }
.ah-card__header { display: flex; align-items: center; gap: 14px; min-height: 84px; box-sizing: border-box; padding: 16px 20px; }
.ah-card__icon { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; }
.ah-card__heading { min-width: 0; flex: 1; }
.ah-card__heading h2 { margin: 0; color: ${INK.primary} !important; font-size: 1.125rem; font-weight: 500; line-height: 1.3; }
.ah-card__heading p { margin: 4px 0 0; color: ${INK.secondary}; font-size: 0.8125rem; line-height: 1.4; }
.ah-card__count { flex: none; color: ${INK.primary}; min-width: 28px; box-sizing: border-box; padding: 4px 8px; border-radius: 12px; text-align: center; font-size: 0.75rem; font-weight: 500; }
.ah-card ul { list-style: none; margin: 0; padding: 0 0 8px; }
.ah-link { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 0 20px; color: ${INK.primary}; text-decoration: none; font-size: 0.9375rem; }
.ah-link:hover { background: ${SUBTLE}; }
.ah-link:focus-visible { outline: 2px solid #2B7ABC; outline-offset: -2px; background: ${SUBTLE}; }
.ah-link__arrow { color: ${INK.secondary}; font-size: 1.4rem; line-height: 1; transition: transform 0.15s; }
.ah-link:hover .ah-link__arrow { transform: translateX(3px); }
.ah-empty { grid-column: 1 / -1; padding: 32px; border-radius: 4px; background: ${PAPER}; color: ${INK.secondary}; box-shadow: ${ELEVATION[1]}; }
.ah-empty strong { display: block; margin-bottom: 6px; color: ${INK.primary}; font-weight: 500; }
.ah-skip:focus { position: static !important; width: auto !important; height: auto !important; overflow: visible; clip: auto; clip-path: none; white-space: normal; margin: 8px; padding: 8px; background: #fff; color: #000; }
@media (max-width: 600px) { .ah-header__content { padding: 24px 16px; } .ah-main { padding: 20px 16px 0; } .ah-grid { gap: 16px; } .ah-card__header { padding: 14px 16px; } .ah-link { padding: 0 16px; } }
@media (prefers-reduced-motion: reduce) { .ah-card, .ah-link__arrow { transition: none; } }`

function SectionCard({section, idPrefix}: {section: Section; idPrefix: string}) {
  const {color, Icon} = SECTION_STYLE[section.key]
  const headingId = `${idPrefix}-heading-${section.key}`
  const sectionId = `${idPrefix}-section-${section.key}`
  return (
    <section
      aria-labelledby={headingId}
      id={sectionId}
      className="ah-card"
      style={{borderTopColor: ink(color)}}
    >
      <div className="ah-card__header" style={{background: tint(color, 0.12)}}>
        <span
          aria-hidden="true"
          className="ah-card__icon"
          style={{background: ink(color), color: '#fff'}}
        >
          <Icon color="primary-inverse" />
        </span>
        <div className="ah-card__heading">
          <h2 id={headingId}>{section.title}</h2>
          <p>{section.description}</p>
        </div>
        <span
          className="ah-card__count"
          aria-label={I18n.t(
            {one: '%{count} destination', other: '%{count} destinations'},
            {count: section.items.length},
          )}
          style={{background: tint(color, 0.18), color: INK.primary}}
        >
          {section.items.length}
        </span>
      </div>
      <ul>
        {section.items.map(item => (
          <li key={item.key}>
            <a className="ah-link" href={item.path}>
              <span>{item.label}</span>
              <span className="ah-link__arrow" aria-hidden="true">
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
  useMaterialPage()
  const appBar = ink(useThemeTokens().appBar)
  const sections = useMemo(() => buildSections(config), [config])
  const destinationCount = sections.reduce((sum, section) => sum + section.items.length, 0)

  return (
    <div className="ah-root">
      <style>{styles(appBar)}</style>
      <div>
        <a className="ah-skip screenreader-only" href="#admin-hub-sections">
          {I18n.t('Skip to administration sections')}
        </a>
        <header className="ah-header">
          <div aria-hidden="true" className="ah-header__stripe">
            {PALETTE.map(color => (
              <span key={color} style={{flex: 1, background: color}} />
            ))}
          </div>
          <div className="ah-header__content">
            <div className="ah-header__account">
              <IconAdminLine color="primary-inverse" />
              {config.account.name}
            </div>
            <h1>{I18n.t('Administration')}</h1>
          </div>
        </header>

        <main className="ah-main" id="admin-hub-sections">
          <div className="ah-summary">
            <span>
              {I18n.t(
                {
                  one: '%{count} destination across %{sections} areas',
                  other: '%{count} destinations across %{sections} areas',
                },
                {count: destinationCount, sections: sections.length},
              )}
            </span>
          </div>
          <div className="ah-grid">
            {sections.map(section => (
              <SectionCard key={section.key} section={section} idPrefix="ah-background" />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
