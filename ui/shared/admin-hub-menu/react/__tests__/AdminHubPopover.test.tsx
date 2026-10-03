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
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import doFetchApi from '@canvas/do-fetch-api-effect'
import AdminHubPopover from '../AdminHubPopover'
import type {HubConfig} from '../types'

vi.mock('@canvas/do-fetch-api-effect')

const config: HubConfig = {
  account: {id: '1', name: 'Northside High'},
  tabs: [
    {css_class: 'courses', path: '/accounts/1', label: 'Courses'},
    {css_class: 'permissions', path: '/accounts/1/permissions', label: 'Permissions'},
    {css_class: 'rubrics', path: '/accounts/1/rubrics', label: 'Rubrics'},
  ],
  settings_tabs: [{id: 'quotas', label: 'Quotas', path: '/accounts/1/settings#tab-quotas'}],
  self_paced: [],
}

function Harness({onHide = () => {}}: {onHide?: () => void}) {
  return (
    <>
      <button id="trigger" type="button">
        Admin
      </button>
      <AdminHubPopover
        hubPath="/accounts/1/hub"
        isShowingContent={true}
        onHide={onHide}
        positionTarget={() => document.getElementById('trigger')}
      />
    </>
  )
}

describe('AdminHubPopover', () => {
  beforeEach(() => {
    vi.mocked(doFetchApi).mockResolvedValue({json: config} as never)
  })

  it('loads the hub config from the hub path as json', async () => {
    render(<Harness />)
    await screen.findByRole('link', {name: 'Quotas'})
    expect(doFetchApi).toHaveBeenCalledWith(expect.objectContaining({path: '/accounts/1/hub.json'}))
  })

  it('lists every section as a heading with its links, without navigating', async () => {
    render(<Harness />)
    expect(await screen.findByRole('heading', {name: 'People and courses'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Courses'})).toHaveAttribute('href', '/accounts/1')
    expect(screen.getByRole('link', {name: 'Permissions'})).toHaveAttribute(
      'href',
      '/accounts/1/permissions',
    )
    expect(screen.getByText('Northside High')).toBeInTheDocument()
  })

  it('colour-codes each section with its own colour, matching the hub page', async () => {
    render(<Harness />)
    await screen.findByRole('link', {name: 'Courses'})
    const color = (name: string) => screen.getByRole('region', {name}).style.borderLeftColor
    const people = color('People and courses')
    expect(people).not.toBe('')
    expect(color('Learning')).not.toBe('')
    expect(color('Learning')).not.toBe(people)
    expect(screen.getByRole('heading', {name: 'People and courses'}).style.background).not.toBe('')
  })

  it('filters as the admin types and says when nothing matches', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(await screen.findByLabelText('Find a setting or page'), 'perm')
    expect(screen.getByRole('link', {name: 'Permissions'})).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: 'Quotas'})).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Find a setting or page'))
    await user.type(screen.getByLabelText('Find a setting or page'), 'zzz')
    expect(screen.getByText('Nothing matches "zzz". Try a different search.')).toBeInTheDocument()
  })

  it('links to all accounts in the footer', async () => {
    render(<Harness />)
    expect(await screen.findByRole('link', {name: 'All accounts'})).toHaveAttribute(
      'href',
      '/accounts',
    )
  })

  it('shows an error when the config cannot be loaded', async () => {
    vi.mocked(doFetchApi).mockRejectedValue(new Error('nope'))
    render(<Harness />)
    expect(await screen.findByText('Could not load the admin menu.')).toBeInTheDocument()
  })

  it('asks to hide on Escape', async () => {
    const onHide = vi.fn()
    render(<Harness onHide={onHide} />)
    await screen.findByRole('link', {name: 'Quotas'})
    await waitFor(() => expect(document.activeElement).not.toBe(document.body))
    fireEvent.keyUp(document.activeElement as Element, {key: 'Escape', keyCode: 27})
    await waitFor(() => expect(onHide).toHaveBeenCalled())
  })
})
