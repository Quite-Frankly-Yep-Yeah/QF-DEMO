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

import React, {useEffect, useState} from 'react'
import AdminHubPopover from './AdminHubPopover'

const LINK_ID = 'top_bar_admin_link'

type Props = {hubPath: string}

// The material top bar's Admin link opens the admin hub bubble under it instead
// of going to the hub page. The link is server-rendered, so it's bound by id.
export default function TopBarAdminMenu({hubPath}: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // capture phase: the popover's own outside-click handler must not see this
    // click, or it would close the bubble just before this toggle reopens it
    const onClick = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest?.(`#${LINK_ID}`)) return
      event.preventDefault()
      event.stopPropagation()
      setOpen(isOpen => !isOpen)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return (
    <AdminHubPopover
      hubPath={hubPath}
      isShowingContent={open}
      onHide={() => setOpen(false)}
      positionTarget={() => document.getElementById(LINK_ID)}
      placement="bottom center"
    />
  )
}
