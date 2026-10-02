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

// On desktop the top bar's Account link opens the account tray (the one
// SideNav or the older global nav renders, even while that side bar is hidden)
// instead of going to the settings page. Without that tray the link navigates
// as usual. Returns a function that removes the listener.
export function bindTopBarAccountLink(doc: Document = document): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null
    if (!target?.closest?.('#top_bar_account_link')) return
    const tray = doc.getElementById('profile-tray') ?? doc.getElementById('global_nav_profile_link')
    if (!tray) return
    event.preventDefault()
    tray.click()
  }
  doc.addEventListener('click', onClick)
  return () => doc.removeEventListener('click', onClick)
}
