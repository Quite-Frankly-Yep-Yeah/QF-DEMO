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
import {cleanup, render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {THEMES, type ThemeId} from '@canvas/material/themes'
import ThemePopover from '../ThemePopover'

// jsdom reports hex colors as rgb()
const hex = (value: string) => {
  const n = parseInt(value.slice(1), 16)
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`
}

// The theme cards sit in the "Themes" group; the accent swatches below also have
// radio names starting with "Light" (Light blue, Light green).
function themeCard(_query: string, name: RegExp): HTMLElement {
  return within(screen.getByRole('radiogroup', {name: 'Themes'})).getByRole('radio', {name})
}

describe('ThemePopover', () => {
  it('lists a radio per theme with the current one checked', () => {
    render(<ThemePopover theme="mocha" accent={null} onChoose={vi.fn()} onChooseAccent={vi.fn()} />)
    expect(themeCard('getByRole', /Catppuccin Mocha/)).toHaveAttribute('aria-checked', 'true')
    expect(themeCard('getByRole', /Light/)).toHaveAttribute('aria-checked', 'false')
  })

  it("draws each card's preview from that theme's own tokens", () => {
    render(<ThemePopover theme="light" accent={null} onChoose={vi.fn()} onChooseAccent={vi.fn()} />)
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
    render(<ThemePopover theme="mocha" accent={null} onChoose={vi.fn()} onChooseAccent={vi.fn()} />)
    expect(screen.getAllByText('Current theme')).toHaveLength(1)
    expect(themeCard('getByRole', /Catppuccin Mocha/)).toHaveTextContent('Current theme')
  })

  it('calls onChoose with the id of the picked theme', async () => {
    const onChoose = vi.fn()
    render(
      <ThemePopover theme="light" accent={null} onChoose={onChoose} onChooseAccent={vi.fn()} />,
    )
    await userEvent.click(themeCard('getByRole', /Catppuccin Mocha/))
    expect(onChoose).toHaveBeenCalledWith('mocha')
  })

  describe('accent footer', () => {
    const renderFooter = (accent: string | null, theme: ThemeId = 'mocha') => {
      const onChooseAccent = vi.fn()
      render(
        <ThemePopover
          theme={theme}
          accent={accent}
          onChoose={vi.fn()}
          onChooseAccent={onChooseAccent}
        />,
      )
      return {onChooseAccent, group: screen.getByRole('radiogroup', {name: 'Accent color'})}
    }

    it('offers the Material accents on Light, and only those', () => {
      const {group} = renderFooter(null, 'light')
      expect(within(group).getAllByRole('radio')).toHaveLength(1 + 19)
      expect(within(group).getByRole('radio', {name: 'Teal (Material)'})).toBeInTheDocument()
      expect(within(group).queryByRole('radio', {name: 'Mauve (Catppuccin)'})).toBeNull()
      expect(within(group).getByRole('radio', {name: 'Theme default'})).toHaveAttribute(
        'aria-checked',
        'true',
      )
    })

    it.each(['latte', 'frappe', 'macchiato', 'mocha'] as const)(
      'offers only the Catppuccin accents on %s',
      flavor => {
        const {group} = renderFooter(null, flavor)
        expect(within(group).getAllByRole('radio')).toHaveLength(1 + 14)
        expect(within(group).getByRole('radio', {name: 'Mauve (Catppuccin)'})).toBeInTheDocument()
        expect(within(group).queryByRole('radio', {name: 'Teal (Material)'})).toBeNull()
      },
    )

    it('still shows a saved accent from the other family, checked, so it can be seen and reset', () => {
      const {group} = renderFooter('material:teal', 'mocha')
      expect(within(group).getAllByRole('radio')).toHaveLength(1 + 14 + 1)
      expect(within(group).getByRole('radio', {name: 'Teal (Material)'})).toHaveAttribute(
        'aria-checked',
        'true',
      )
    })

    it('checks the chosen accent and not the default', () => {
      const {group} = renderFooter('material:teal', 'light')
      expect(within(group).getByRole('radio', {name: 'Teal (Material)'})).toHaveAttribute(
        'aria-checked',
        'true',
      )
      expect(within(group).getByRole('radio', {name: 'Theme default'})).toHaveAttribute(
        'aria-checked',
        'false',
      )
    })

    it('reports the picked accent, and null for the theme default', async () => {
      const {onChooseAccent, group} = renderFooter('material:teal', 'mocha')
      await userEvent.click(within(group).getByRole('radio', {name: 'Mauve (Catppuccin)'}))
      expect(onChooseAccent).toHaveBeenLastCalledWith('catppuccin:mauve')
      await userEvent.click(within(group).getByRole('radio', {name: 'Theme default'}))
      expect(onChooseAccent).toHaveBeenLastCalledWith(null)
    })

    it("shows Catppuccin swatches in the current flavor's shade", () => {
      const {group} = renderFooter(null, 'latte')
      const swatch = within(group).getByRole('radio', {name: 'Mauve (Catppuccin)'})
      expect(swatch.style.background).toBe(hex('#8839EF'))
      cleanup()
      const mocha = renderFooter(null, 'mocha')
      expect(
        within(mocha.group).getByRole('radio', {name: 'Mauve (Catppuccin)'}).style.background,
      ).toBe(hex('#CBA6F7'))
    })

    it('draws the previews with the chosen accent', () => {
      renderFooter('material:teal')
      expect(screen.getByTestId('theme-preview-bar-mocha').style.background).toBe(hex('#009688'))
      expect(screen.getByTestId('theme-preview-accent-light').style.background).toBe(hex('#009688'))
    })
  })
})
