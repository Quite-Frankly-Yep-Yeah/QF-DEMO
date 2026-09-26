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

import React, {Component} from 'react'
import {SVGIcon} from '@instructure/ui-svg-images'

type SVGIconProps = React.ComponentProps<typeof SVGIcon>

// Builds an icon component that behaves exactly like an InstUI one (same
// props, statics and `name` attribute, so sizing, color, rotation, titles,
// RTL flipping and tests that look for `svg[name="IconAdd"]` all keep
// working), but draws a Material Symbol.
export function materialIcon(
  displayName: string,
  glyphName: string,
  variant: 'Line' | 'Solid',
  d: string,
  bidirectional = false,
) {
  const name = displayName.replace(/(Line|Solid)$/, '')

  class MaterialIcon extends Component<SVGIconProps> {
    static displayName = displayName
    static glyphName = glyphName
    static variant = variant
    static allowedProps = [...(SVGIcon as unknown as {allowedProps: string[]}).allowedProps]

    ref: Element | null = null

    handleRef = (el: Element | null) => {
      const {elementRef} = this.props as {elementRef?: (el: Element | null) => void}
      this.ref = el
      if (typeof elementRef === 'function') elementRef(el)
    }

    render() {
      return (
        <SVGIcon
          {...(bidirectional ? {bidirectional: true} : {})}
          {...this.props}
          name={name}
          viewBox="0 -960 960 960"
          elementRef={this.handleRef}
        >
          <path d={d} />
        </SVGIcon>
      )
    }
  }

  return MaterialIcon
}
