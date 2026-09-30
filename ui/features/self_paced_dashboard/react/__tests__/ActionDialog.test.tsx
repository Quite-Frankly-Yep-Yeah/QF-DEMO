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
import ActionDialog from '../ActionDialog'

describe('ActionDialog', () => {
  it('fills the reason from a suggestion', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <ActionDialog
        spec={{
          title: 'Exempt: Lesson 1',
          confirmLabel: 'Exempt',
          askReason: true,
          reasonPresets: ['Accommodation: reduced workload'],
        }}
        onSubmit={onSubmit}
        onClose={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('button', {name: 'Accommodation: reduced workload'}))
    await userEvent.click(screen.getByRole('button', {name: 'Exempt'}))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'Accommodation: reduced workload'}),
    )
  })

  it('offers no suggestions without any', () => {
    render(
      <ActionDialog
        spec={{title: 'Exempt: Lesson 1', confirmLabel: 'Exempt', askReason: true}}
        onSubmit={vi.fn()}
        onClose={() => {}}
      />,
    )
    expect(screen.queryByRole('group', {name: 'Suggested reasons'})).not.toBeInTheDocument()
  })
})
