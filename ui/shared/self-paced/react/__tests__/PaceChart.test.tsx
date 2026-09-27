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
import {fireEvent, render, screen, within} from '@testing-library/react'
import PaceChart, {tableDates} from '../PaceChart'
import PaceBadge from '../PaceBadge'
import {pacingFixture} from '../../__tests__/pacingFixtures'

const {chart} = pacingFixture()

describe('PaceChart', () => {
  it('names every line in a legend', () => {
    render(<PaceChart chart={chart} color="#2a78d6" title="Your progress" />)
    const legend = screen.getByRole('figure').querySelector('figcaption') as HTMLElement

    expect(within(legend).getByText('Original plan')).toBeInTheDocument()
    expect(within(legend).getByText('Plan from today')).toBeInTheDocument()
    expect(within(legend).getAllByText('Your progress')).toHaveLength(2) // title and legend
  })

  it('gives screen readers the same numbers as a table', () => {
    render(<PaceChart chart={chart} color="#2a78d6" title="Your progress" />)
    const rows = within(screen.getByRole('table')).getAllByRole('row')

    // header, Monday (every fifth plan day), Wednesday (today), Friday (the last)
    expect(rows).toHaveLength(4)
    expect(
      within(rows[1])
        .getAllByRole('cell')
        .map(cell => cell.textContent),
    ).toEqual(['20%', '25%'])
    expect(
      within(rows[3])
        .getAllByRole('cell')
        .map(cell => cell.textContent),
    ).toEqual(['100%', '–'])
  })

  it("shows the day's values on hover", () => {
    render(<PaceChart chart={chart} color="#2a78d6" title="Your progress" />)
    const hit = screen.getByTestId('pace-chart-hit')

    // the plot is 508px wide from x=40 over four days; 167px is Tuesday
    fireEvent.mouseMove(hit, {clientX: 167})
    const tip = screen.getByTestId('pace-chart-tip')
    expect(tip).toHaveTextContent('Your progress50%')
    expect(tip).toHaveTextContent('Original plan40%')
    expect(tip).not.toHaveTextContent('Plan from today')

    fireEvent.mouseLeave(hit)
    expect(screen.queryByTestId('pace-chart-tip')).not.toBeInTheDocument()
  })

  it('samples about one table row a week', () => {
    expect(tableDates(chart)).toEqual(['2026-10-05', '2026-10-07', '2026-10-09'])
  })
})

describe('PaceBadge', () => {
  it('pairs a shape with words', () => {
    const {container} = render(<PaceBadge daysAhead={-4} />)

    expect(container).toHaveTextContent('4 days behind')
    expect(container.querySelector('[data-pace="far_behind"] svg')).toBeInTheDocument()
  })

  it('shows a dash without a plan', () => {
    const {container} = render(<PaceBadge daysAhead={null} />)

    expect(container).toHaveTextContent('–')
  })
})
