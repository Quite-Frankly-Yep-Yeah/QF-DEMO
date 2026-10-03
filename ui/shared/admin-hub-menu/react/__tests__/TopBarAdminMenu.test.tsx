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
import {render, screen, waitFor} from '@testing-library/react'
import doFetchApi from '@canvas/do-fetch-api-effect'
import TopBarAdminMenu from '../TopBarAdminMenu'

vi.mock('@canvas/do-fetch-api-effect')

describe('TopBarAdminMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = '<a id="top_bar_admin_link" href="/accounts/1/hub">Admin</a>'
    vi.mocked(doFetchApi).mockResolvedValue({
      json: {
        account: {id: '1', name: 'Northside High'},
        tabs: [{css_class: 'permissions', path: '/accounts/1/permissions', label: 'Permissions'}],
        settings_tabs: [],
        self_paced: [],
      },
    } as never)
  })

  const adminLink = () => document.getElementById('top_bar_admin_link') as HTMLAnchorElement
  const click = () => {
    const event = new MouseEvent('click', {bubbles: true, cancelable: true})
    adminLink().dispatchEvent(event)
    return event
  }

  it('opens the hub bubble under the Admin link instead of navigating', async () => {
    render(<TopBarAdminMenu hubPath="/accounts/1/hub" />)
    const event = click()
    expect(event.defaultPrevented).toBe(true)
    expect(await screen.findByRole('link', {name: 'Permissions'})).toBeInTheDocument()
    expect(doFetchApi).toHaveBeenCalledWith(expect.objectContaining({path: '/accounts/1/hub.json'}))
  })

  it('closes when the Admin link is clicked again', async () => {
    render(<TopBarAdminMenu hubPath="/accounts/1/hub" />)
    click()
    await screen.findByRole('link', {name: 'Permissions'})
    click()
    await waitFor(() =>
      expect(screen.queryByRole('link', {name: 'Permissions'})).not.toBeInTheDocument(),
    )
  })

  it('ignores clicks on other links', () => {
    document.body.insertAdjacentHTML('beforeend', '<a id="other" href="/x">x</a>')
    render(<TopBarAdminMenu hubPath="/accounts/1/hub" />)
    const event = new MouseEvent('click', {bubbles: true, cancelable: true})
    document.getElementById('other')?.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})
