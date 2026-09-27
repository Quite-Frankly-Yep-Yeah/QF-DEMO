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
import ParametersFields from '../ParametersFields'

describe('ParametersFields', () => {
  it('switches extended time from a multiplier to minutes', async () => {
    const onChange = vi.fn()
    render(
      <ParametersFields
        kind="extended_time"
        value={{multiplier: 1.5}}
        onChange={onChange}
        idPrefix="t"
      />,
    )
    await userEvent.click(screen.getByLabelText('A number of extra minutes'))
    expect(onChange).toHaveBeenCalledWith({minutes: 30})
  })

  it('offers both pacing modes', async () => {
    const onChange = vi.fn()
    render(
      <ParametersFields
        kind="extended_deadlines"
        value={{percent: 25, mode: 'extend_finish'}}
        onChange={onChange}
        idPrefix="p"
      />,
    )
    await userEvent.click(screen.getByLabelText('Lower the daily target, keep the finish date'))
    expect(onChange).toHaveBeenCalledWith({percent: 25, mode: 'lower_daily'})
  })

  it('asks nothing for instructions-only accommodations', () => {
    const {container} = render(
      <ParametersFields kind="informational" value={{}} onChange={vi.fn()} idPrefix="i" />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
