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

import React, {useRef, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {INK, DIVIDER, ROBOTO} from '@canvas/material'
import {Avatar} from '@instructure/ui-avatar'
import {IconArrowOpenEndLine} from '@instructure/ui-icons'
import {Popover} from '@instructure/ui-popover'
import ThemePopover from './ThemePopover'
import {useThemeChoice} from './useThemeChoice'

const I18n = createI18nScope('account_sidebar')

// The signed-in user's details with a list of buttons under them; each button
// opens a speech-bubble popover. Themes is the only one so far.
export default function AccountSidebar() {
  const user = window.ENV.current_user
  const {theme, accent, choose, chooseAccent} = useThemeChoice()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement | null>(null)
  const avatarUrl = user.avatar_is_fallback ? '' : user.avatar_image_url

  return (
    <div style={{fontFamily: ROBOTO, color: INK.primary}}>
      <div style={{textAlign: 'center', padding: '8px 0 16px'}}>
        <Avatar
          name={user.display_name}
          src={avatarUrl}
          alt={I18n.t('User profile picture')}
          size="x-large"
          display="block"
          margin="auto"
          data-fs-exclude={true}
        />
        <div
          style={{
            margin: '12px 0 2px',
            fontSize: '1.25rem',
            fontWeight: 500,
            wordBreak: 'break-word',
          }}
        >
          {user.display_name}
          {user.pronouns && <span style={{fontStyle: 'italic'}}> ({user.pronouns})</span>}
        </div>
        {user.email && (
          <div style={{color: INK.secondary, fontSize: '0.875rem', wordBreak: 'break-word'}}>
            {user.email}
          </div>
        )}
      </div>
      <Popover
        isShowingContent={open}
        onShowContent={() => setOpen(true)}
        onHideContent={() => setOpen(false)}
        on="click"
        placement="end center"
        shouldContainFocus={true}
        shouldReturnFocus={true}
        shouldCloseOnDocumentClick={true}
        screenReaderLabel={I18n.t('Themes')}
        renderTrigger={
          <button
            ref={button}
            type="button"
            data-testid="themes-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              minHeight: 48,
              padding: '0 16px',
              border: 0,
              borderTop: `1px solid ${DIVIDER}`,
              borderBottom: `1px solid ${DIVIDER}`,
              background: 'transparent',
              color: INK.primary,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <span>{I18n.t('Themes')}</span>
            <IconArrowOpenEndLine size="x-small" />
          </button>
        }
      >
        <ThemePopover
          theme={theme}
          accent={accent}
          onChoose={choose}
          onChooseAccent={chooseAccent}
        />
      </Popover>
    </div>
  )
}
