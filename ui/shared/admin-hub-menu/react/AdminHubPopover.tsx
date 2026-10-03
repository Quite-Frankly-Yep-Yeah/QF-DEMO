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

import React, {useEffect, useMemo, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {DIVIDER, INK, ink, PAPER, ROBOTO, SUBTLE, tint} from '@canvas/material'
import {Popover} from '@instructure/ui-popover'
import {Spinner} from '@instructure/ui-spinner'
import {IconSearchLine} from '@instructure/ui-icons'
import {buildSections, filterSections} from './hubModel'
import {SECTION_COLOR} from './sectionColors'
import type {HubConfig} from './types'

const I18n = createI18nScope('admin_hub')

type Props = {
  // the account's hub page, e.g. /accounts/1/hub; its .json is the config
  hubPath: string
  isShowingContent: boolean
  onHide: () => void
  // the nav item the speech bubble points at
  positionTarget: () => Element | null
  placement?: 'end center' | 'bottom center'
}

const css = `.ahp { width: min(400px, calc(100vw - 32px)); max-height: min(70vh, 560px); overflow-y: auto; box-sizing: border-box; padding: 16px; font-family: ${ROBOTO}; color: ${INK.primary}; background: ${PAPER}; }
.ahp h2 { margin: 0; font-size: 1.125rem; font-weight: 500; }
.ahp__account { margin: 2px 0 12px; color: ${INK.secondary}; font-size: 0.875rem; }
.ahp__search { display: flex; align-items: center; gap: 8px; box-sizing: border-box; min-height: 40px; margin-bottom: 8px; padding: 0 12px; border: 1px solid rgba(0,0,0,0.38); border-radius: 4px; }
.ahp__search input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: ${INK.primary}; font: inherit; }
.ahp section { margin-top: 12px; border-left: 4px solid; border-radius: 4px; overflow: hidden; }
.ahp h3 { margin: 0; padding: 6px 10px; color: ${INK.primary}; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; }
.ahp ul { list-style: none; margin: 0; padding: 0; }
.ahp a { display: block; padding: 8px; border-radius: 4px; color: ${INK.primary}; text-decoration: none; font-size: 0.9375rem; }
.ahp a:hover, .ahp a:focus-visible { background: ${SUBTLE}; }
.ahp__footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid ${DIVIDER}; }
.ahp__note { padding: 24px 0; text-align: center; color: ${INK.secondary}; font-size: 0.875rem; }`

function Content({hubPath}: {hubPath: string}) {
  const [config, setConfig] = useState<HubConfig | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let live = true
    doFetchApi<HubConfig>({path: `${hubPath}.json`})
      .then(({json}) => live && json && setConfig(json))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [hubPath])

  const sections = useMemo(() => (config ? buildSections(config) : []), [config])
  const shown = useMemo(() => filterSections(sections, query), [sections, query])

  return (
    <div className="ahp">
      <style>{css}</style>
      <h2>{I18n.t('Administration')}</h2>
      {config && <div className="ahp__account">{config.account.name}</div>}
      {failed && <div className="ahp__note">{I18n.t('Could not load the admin menu.')}</div>}
      {!config && !failed && (
        <div className="ahp__note">
          <Spinner size="small" renderTitle={I18n.t('Loading')} />
        </div>
      )}
      {config && (
        <>
          <label className="ahp__search">
            <IconSearchLine color="primary" />
            <input
              type="search"
              aria-label={I18n.t('Find a setting or page')}
              placeholder={I18n.t('Find a setting or page')}
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </label>
          {shown.map(section => (
            <section
              key={section.key}
              aria-label={section.title}
              style={{borderLeftColor: ink(SECTION_COLOR[section.key])}}
            >
              <h3 style={{background: tint(SECTION_COLOR[section.key], 0.14)}}>{section.title}</h3>
              <ul>
                {section.items.map(item => (
                  <li key={item.key}>
                    <a href={item.path}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {shown.length === 0 && (
            <div className="ahp__note">
              {I18n.t('Nothing matches "%{query}". Try a different search.', {
                query: query.trim(),
              })}
            </div>
          )}
        </>
      )}
      <div className="ahp__footer">
        <a href="/accounts">{I18n.t('All accounts')}</a>
      </div>
    </div>
  )
}

// The admin hub as a speech-bubble popover that points at the nav's Admin item.
export default function AdminHubPopover({
  hubPath,
  isShowingContent,
  onHide,
  positionTarget,
  placement = 'end center',
}: Props) {
  return (
    <Popover
      isShowingContent={isShowingContent}
      onHideContent={onHide}
      on="click"
      positionTarget={positionTarget}
      placement={placement}
      shouldContainFocus={true}
      shouldReturnFocus={true}
      shouldCloseOnDocumentClick={true}
      screenReaderLabel={I18n.t('Administration menu')}
    >
      <Content hubPath={hubPath} />
    </Popover>
  )
}
