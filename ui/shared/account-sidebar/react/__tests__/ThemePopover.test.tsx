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
import {THEMES} from '@canvas/material/themes'
import ThemePopover from '../ThemePopover'

// jsdom reports hex colors as rgb()
const hex = (value: string) => {
  const n = parseInt(value.slice(1), 16)
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`
}

describe('ThemePopover', () => {
  it('lists a radio per theme with the current one checked', () => {
    render(<ThemePopover theme="mocha" onChoose={vi.fn()} />)
    expect(screen.getByRole('radio', {name: /Catppuccin Mocha/})).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', {name: /Light/})).toHaveAttribute('aria-checked', 'false')
  })

  it("draws each card's preview from that theme's own tokens", () => {
    render(<ThemePopover theme="light" onChoose={vi.fn()} />)
    for (const [id, {tokens}] of Object.entries(THEMES)) {
      const preview = screen.getByTestId(`theme-preview-${id}`)
      expect(preview.style.background).toBe(hex(tokens.surface))
      expect(screen.getByTestId(`theme-preview-bar-${id}`).style.background).toBe(
        hex(tokens.appBar),
      )
      expect(screen.getByTestId(`theme-preview-card-${id}`).style.background).toBe(
        hex(tokens.paper),
      )
      expect(screen.getByTestId(`theme-preview-accent-${id}`).style.background).toBe(
        hex(tokens.accent),
      )
    }
  })

  it('marks the current theme with a label as well as a check', () => {
    render(<ThemePopover theme="mocha" onChoose={vi.fn()} />)
    expect(screen.getAllByText('Current theme')).toHaveLength(1)
    expect(screen.getByRole('radio', {name: /Catppuccin Mocha/})).toHaveTextContent('Current theme')
  })

  it('calls onChoose with the id of the picked theme', async () => {
    const onChoose = vi.fn()
    render(<ThemePopover theme="light" onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('radio', {name: /Catppuccin Mocha/}))
    expect(onChoose).toHaveBeenCalledWith('mocha')
  })
})
