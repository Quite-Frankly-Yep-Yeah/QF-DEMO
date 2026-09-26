/*
 * Copyright (C) 2026 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import {applyMaterialOverrides} from '../materialTheme'

const base: any = {
  colors: {brand: '#ff0000'},
  borders: {radiusSmall: '0.125rem', widthSmall: '1px'},
  shadows: {depth1: 'x'},
  typography: {fontFamily: 'Lato', fontSizeSmall: '14px'},
}

describe('applyMaterialOverrides', () => {
  it('keeps brand colors and unrelated tokens', () => {
    const t: any = applyMaterialOverrides(base)
    expect(t.colors).toBe(base.colors)
    expect(t.borders.widthSmall).toBe('1px')
    expect(t.typography.fontSizeSmall).toBe('14px')
  })

  it('applies MD radius, shadows and Roboto', () => {
    const t: any = applyMaterialOverrides(base)
    expect(t.borders.radiusSmall).toBe('2px')
    expect(t.shadows.depth1).not.toBe('x')
    expect(t.typography.fontFamily).toMatch(/^Roboto/)
  })

  it('adds button and heading overrides without dropping existing ones', () => {
    const withOverrides = {...base, componentOverrides: {BaseButton: {borderWidth: '1px'}, Tabs: {x: 1}}}
    const t: any = applyMaterialOverrides(withOverrides)
    expect(t.componentOverrides.BaseButton.textTransform).toBe('uppercase')
    expect(t.componentOverrides.BaseButton.borderWidth).toBe('1px')
    expect(t.componentOverrides.Tabs).toEqual({x: 1})
    expect(t.componentOverrides.Heading.h3FontWeight).toBe(500)
  })

  it('softens surfaces to grey 100 without touching text or button colors', () => {
    const t: any = applyMaterialOverrides({
      ...base,
      componentOverrides: {View: {colorPrimaryInverse: '#FFFFFF'}},
    })
    expect(t.componentOverrides.View.backgroundPrimary).toBe('#F5F5F5')
    expect(t.componentOverrides.View.colorPrimaryInverse).toBe('#FFFFFF')
    expect(t.componentOverrides.Options.background).toBe('#F5F5F5')
    expect(t.componentOverrides.BaseButton.background).toBeUndefined()
  })

  it('is a no-op in high contrast', () => {
    expect(applyMaterialOverrides(base, {highContrast: true})).toBe(base)
  })

  it('keeps the dyslexic font', () => {
    const t: any = applyMaterialOverrides(base, {useDyslexicFont: true})
    expect(t.typography.fontFamily).toBe('Lato')
  })
})
