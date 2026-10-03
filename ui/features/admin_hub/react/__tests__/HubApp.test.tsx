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
import {render, screen} from '@testing-library/react'
import HubApp from '../HubApp'
import type {HubConfig} from '@canvas/admin-hub-menu/react/types'

const config: HubConfig = {
  account: {id: '1', name: 'Northside High'},
  tabs: [
    {css_class: 'courses', path: '/accounts/1', label: 'Courses'},
    {css_class: 'permissions', path: '/accounts/1/permissions', label: 'Permissions'},
  ],
  settings_tabs: [{id: 'quotas', label: 'Quotas', path: '/accounts/1/settings#tab-quotas'}],
  self_paced: [],
}

describe('HubApp', () => {
  it('shows the account name, the title and a card per section with links', () => {
    render(<HubApp config={config} />)
    expect(screen.getByRole('heading', {level: 1, name: 'Administration'})).toBeInTheDocument()
    expect(screen.getByText('Northside High')).toBeInTheDocument()
    expect(screen.getByRole('region', {name: 'People and courses'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: /Quotas/})).toHaveAttribute(
      'href',
      '/accounts/1/settings#tab-quotas',
    )
  })

  it('leaves the menu to the nav popover: no dialog and no open-menu button', () => {
    render(<HubApp config={config} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Open admin menu'})).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toBeVisible()
  })
})
