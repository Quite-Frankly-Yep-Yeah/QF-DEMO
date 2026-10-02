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

import {bindTopBarAccountLink} from '../topBarAccountLink'

let unbind = () => {}

function setup(withTray: boolean, trayId = 'profile-tray') {
  document.body.innerHTML = `
    <a id="top_bar_account_link" href="/profile/settings">Account</a>
    ${withTray ? `<a id="${trayId}" href="/profile/settings">Account</a>` : ''}
  `
  const trayClick = vi.fn((e: Event) => e.preventDefault())
  document.getElementById(trayId)?.addEventListener('click', trayClick)
  unbind = bindTopBarAccountLink(document)
  const link = document.getElementById('top_bar_account_link') as HTMLAnchorElement
  const event = new MouseEvent('click', {bubbles: true, cancelable: true})
  link.dispatchEvent(event)
  return {event, trayClick}
}

describe('bindTopBarAccountLink', () => {
  afterEach(() => {
    unbind()
    document.body.innerHTML = ''
  })

  it('opens the account tray instead of navigating', () => {
    const {event, trayClick} = setup(true)
    expect(trayClick).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('also works with the older global nav link', () => {
    const {event, trayClick} = setup(true, 'global_nav_profile_link')
    expect(trayClick).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('lets the link navigate when there is no account tray', () => {
    const {event} = setup(false)
    expect(event.defaultPrevented).toBe(false)
  })
})
