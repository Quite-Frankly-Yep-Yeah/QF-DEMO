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
import userEvent from '@testing-library/user-event'
import ThemePopover from '../ThemePopover'

describe('ThemePopover', () => {
  it('lists a radio per theme with the current one checked', () => {
    render(<ThemePopover theme="mocha" onChoose={vi.fn()} />)
    expect(screen.getByRole('radio', {name: /Catppuccin Mocha/})).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', {name: /Light/})).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChoose with the id of the picked theme', async () => {
    const onChoose = vi.fn()
    render(<ThemePopover theme="light" onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('radio', {name: /Catppuccin Mocha/}))
    expect(onChoose).toHaveBeenCalledWith('mocha')
  })
})
