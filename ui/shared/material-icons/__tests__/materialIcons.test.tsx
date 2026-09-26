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
import {render} from '@testing-library/react'
import * as original from '@instructure/ui-icons'
import * as icons from '../index'

function svgOf(element: React.ReactElement): SVGSVGElement {
  const {container} = render(element)
  return container.querySelector('svg') as SVGSVGElement
}

describe('Material icons in place of InstUI icons', () => {
  it('draws a Material Symbol but keeps the InstUI name', () => {
    const svg = svgOf(<icons.IconAddLine />)

    expect(svg.getAttribute('name')).toBe('IconAdd')
    expect(svg.getAttribute('viewBox')).toBe('0 -960 960 960')
    expect(svg.querySelector('path')?.getAttribute('d')).toMatch(/^M450-450H200/)
  })

  it('uses the filled symbol for the Solid variant', () => {
    const line = svgOf(<icons.IconHomeLine />)
      .querySelector('path')
      ?.getAttribute('d')
    const solid = svgOf(<icons.IconHomeSolid />)
      .querySelector('path')
      ?.getAttribute('d')

    expect(solid).toBeTruthy()
    expect(solid).not.toBe(line)
  })

  it('takes the same props as an InstUI icon', () => {
    const svg = svgOf(<icons.IconTrashLine size="small" title="Delete" color="error" />)

    expect(svg.getAttribute('aria-hidden')).not.toBe('true')
    expect(svg.querySelector('title')?.textContent).toBe('Delete')
  })

  it('keeps the statics InstUI code reads', () => {
    expect(icons.IconEditLine.displayName).toBe('IconEditLine')
    expect((icons.IconEditLine as unknown as {variant: string}).variant).toBe('Line')
    expect((icons.IconEditSolid as unknown as {glyphName: string}).glyphName).toBe(
      (original.IconEditSolid as unknown as {glyphName: string}).glyphName,
    )
  })

  it('leaves brand logos alone', () => {
    expect(icons.IconFacebookLine).toBe(original.IconFacebookLine)
    expect(svgOf(<icons.IconFacebookLine />).getAttribute('viewBox')).not.toBe('0 -960 960 960')
  })

  it('replaces every everyday icon', () => {
    const everyday = [
      'IconAddLine',
      'IconEditLine',
      'IconTrashLine',
      'IconSearchLine',
      'IconXSolid',
      'IconArrowOpenDownLine',
      'IconSettingsLine',
      'IconCalendarMonthLine',
      'IconMoreLine',
    ] as const
    everyday.forEach(name => {
      expect(icons[name]).not.toBe(original[name])
    })
  })
})
