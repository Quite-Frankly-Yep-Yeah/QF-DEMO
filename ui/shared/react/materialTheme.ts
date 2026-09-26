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

import type {ThemeOrOverride} from '@instructure/emotion/types/EmotionTypes'

const MD_FONT_FAMILY = 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif'
const MD_RADIUS = '2px'
const MD_SURFACE = '#F5F5F5'

// Material Design 1 elevations (umbra, penumbra, ambient)
const MD_SHADOWS = {
  depth1:
    '0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(0, 0, 0, 0.14), 0 2px 1px -1px rgba(0, 0, 0, 0.12)',
  depth2:
    '0 3px 3px -2px rgba(0, 0, 0, 0.2), 0 3px 4px rgba(0, 0, 0, 0.14), 0 1px 8px rgba(0, 0, 0, 0.12)',
  depth3:
    '0 5px 5px -3px rgba(0, 0, 0, 0.2), 0 8px 10px 1px rgba(0, 0, 0, 0.14), 0 3px 14px 2px rgba(0, 0, 0, 0.12)',
}

type Options = {
  highContrast?: boolean
  useDyslexicFont?: boolean
}

type Theme = Record<string, any>

/**
 * Applies Material Design 1 shape, elevation and type on top of a quite frankly an example LMS
 * InstUI theme. Never touches `colors`, so brand (Theme Editor) colors keep
 * flowing through untouched. No-op for high contrast.
 */
export function applyMaterialOverrides(theme: ThemeOrOverride, options: Options = {}): ThemeOrOverride {
  if (options.highContrast) return theme

  const base = theme as Theme
  const next: Theme = {
    ...base,
    borders: {
      ...base.borders,
      radiusSmall: MD_RADIUS,
      radiusMedium: MD_RADIUS,
      radiusLarge: MD_RADIUS,
    },
    shadows: {...base.shadows, ...MD_SHADOWS},
    componentOverrides: {
      ...base.componentOverrides,
      // Material grey 100 in place of white for surfaces (cards, modals,
      // trays, popovers, tables and menu lists all draw View's primary
      // background). Text and button colors stay as they are.
      View: {...base.componentOverrides?.View, backgroundPrimary: MD_SURFACE},
      ContextView: {...base.componentOverrides?.ContextView, arrowBackgroundColor: MD_SURFACE},
      Options: {...base.componentOverrides?.Options, background: MD_SURFACE},
      BaseButton: {
        ...base.componentOverrides?.BaseButton,
        textTransform: 'uppercase',
        fontWeight: 500,
        letterSpacing: '0.04em',
      },
      Heading: {
        ...base.componentOverrides?.Heading,
        h1FontSize: '2.125rem',
        h2FontSize: '1.5rem',
        h3FontSize: '1.25rem',
        h3FontWeight: 500,
        h4FontSize: '1rem',
        h4FontWeight: 500,
        h5FontSize: '0.875rem',
        h5FontWeight: 500,
      },
    },
  }

  if (!options.useDyslexicFont && base.typography) {
    next.typography = {
      ...base.typography,
      fontFamily: MD_FONT_FAMILY,
    }
  }

  return next as ThemeOrOverride
}
