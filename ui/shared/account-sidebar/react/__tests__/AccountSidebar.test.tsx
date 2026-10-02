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
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountSidebar from '../AccountSidebar'

vi.mock('@canvas/do-fetch-api-effect')
vi.mock('@instructure/platform-alerts')

// The theme cards sit in the "Themes" group; the accent swatches below also have
// radio names starting with "Light" (Light blue, Light green).
function themeCard(query: 'findByRole' | 'getByRole' | 'queryByRole', name: RegExp) {
  const group = screen.queryByRole('radiogroup', {name: 'Themes'})
  if (query === 'findByRole') {
    return screen
      .findByRole('radiogroup', {name: 'Themes'})
      .then(g => within(g).getByRole('radio', {name}))
  }
  if (!group) return null as unknown as HTMLElement
  return within(group)[query]('radio', {name})
}

describe('AccountSidebar', () => {
  beforeEach(() => {
    window.ENV = {
      ...window.ENV,
      THEME: 'light',
      current_user: {display_name: 'Ada Lovelace', avatar_image_url: '', avatar_is_fallback: true},
    } as unknown as typeof window.ENV
    document.documentElement.dataset.theme = 'light'
  })

  it('shows the profile header without an email', () => {
    render(<AccountSidebar />)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByTestId('themes-button')).toBeInTheDocument()
  })

  it('shows the email when the user has one', () => {
    window.ENV.current_user = {...window.ENV.current_user, email: 'ada@example.com'} as never
    render(<AccountSidebar />)
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })

  it('opens the themes popover with the current theme checked', async () => {
    const user = userEvent.setup()
    render(<AccountSidebar />)
    await user.click(screen.getByTestId('themes-button'))
    expect(await themeCard('findByRole', /Light/)).toHaveAttribute('aria-checked', 'true')
    expect(themeCard('getByRole', /Catppuccin Mocha/)).toHaveAttribute('aria-checked', 'false')
  })

  it('closes on Escape and returns focus to the Themes button', async () => {
    const user = userEvent.setup()
    render(<AccountSidebar />)
    await user.click(screen.getByTestId('themes-button'))
    await themeCard('findByRole', /Light/)
    // focus moves into the popover a moment after it opens
    await waitFor(() => expect(screen.getByTestId('themes-button')).not.toHaveFocus())
    fireEvent.keyUp(document.activeElement as Element, {key: 'Escape', keyCode: 27})
    await waitFor(() => expect(themeCard('queryByRole', /Light/)).not.toBeInTheDocument())
    expect(screen.getByTestId('themes-button')).toHaveFocus()
  })
})
