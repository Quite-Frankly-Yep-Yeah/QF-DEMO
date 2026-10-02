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
import ScanCard from '../ScanCard'
import type {ScanItem} from '../types'

const item = (overrides: Partial<ScanItem> = {}): ScanItem => ({
  index: 0,
  line: 1,
  accommodation: 'Extended time on tests and quizzes',
  kind: 'extended_time',
  params: {multiplier: 1.5},
  action: 'add',
  message: null,
  source_quote: 'time and a half on tests',
  page: 3,
  confidence: 'high',
  errors: [],
  included: true,
  ...overrides,
})

describe('ScanCard', () => {
  it('shows what was found, the quote it came from and the page', () => {
    render(<ScanCard item={item()} onChange={vi.fn()} />)
    expect(
      screen.getByRole('heading', {name: 'Extended time on tests and quizzes'}),
    ).toBeInTheDocument()
    expect(screen.getByText(/time and a half on tests/)).toBeInTheDocument()
    expect(screen.getByText('Page 3')).toBeInTheDocument()
    expect(screen.getByText('Confident')).toBeInTheDocument()
  })

  it('says so in words when it is unsure', () => {
    render(<ScanCard item={item({confidence: 'low'})} onChange={vi.fn()} />)
    expect(screen.getByText('Low confidence: check this one')).toBeInTheDocument()
  })

  it('lets the reviewer leave an item out', async () => {
    const onChange = vi.fn()
    render(<ScanCard item={item()} onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox', {name: /Include Extended time/}))
    expect(onChange).toHaveBeenCalledWith({included: false})
  })

  it('lets the reviewer change the settings', async () => {
    const onChange = vi.fn()
    render(<ScanCard item={item()} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', {name: 'Edit settings'}))
    await userEvent.click(screen.getByLabelText('A number of extra minutes'))
    expect(onChange).toHaveBeenCalledWith({params: {minutes: 30}})
  })

  it('announces problems and offers no settings for an instructions-only item', () => {
    const {rerender} = render(
      <ScanCard
        item={item({errors: ['The time multiplier must be more than 1 and at most 5.']})}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('The time multiplier must be more than 1')
    rerender(<ScanCard item={item({kind: 'informational', params: {}})} onChange={vi.fn()} />)
    expect(screen.queryByRole('button', {name: 'Edit settings'})).not.toBeInTheDocument()
  })

  it('can be used from the keyboard', async () => {
    const onChange = vi.fn()
    render(<ScanCard item={item()} onChange={onChange} />)
    await userEvent.tab()
    expect(screen.getByRole('checkbox', {name: /Include Extended time/})).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenCalledWith({included: false})
  })
})
