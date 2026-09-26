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

// The dashboard's Material Design 1 look, matching the course map and the
// Students page: Roboto, big light headings, a colored app bar with white
// tabs, 2px corners, paper shadows and a color for every widget.

export const ROBOTO = "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"

// The app bar: the brand's primary blue.
export const APP_BAR = '#2B7ABC'

// Material grey 100, the page behind the cards.
export const SURFACE = '#F5F5F5'

// One color per widget, in order: the same palette the course map and the
// Students page give courses.
export const ACCENTS = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
]

export function accentFor(index: number): string {
  return ACCENTS[((index % ACCENTS.length) + ACCENTS.length) % ACCENTS.length]
}

// Material 1 paper shadows, by elevation.
export const ELEVATION = {
  1: '0 1px 3px rgba(0,0,0,0.2), 0 1px 1px rgba(0,0,0,0.14), 0 2px 1px -1px rgba(0,0,0,0.12)',
  2: '0 1px 5px rgba(0,0,0,0.2), 0 2px 2px rgba(0,0,0,0.14), 0 3px 1px -2px rgba(0,0,0,0.12)',
  4: '0 2px 4px -1px rgba(0,0,0,0.2), 0 4px 5px rgba(0,0,0,0.14), 0 1px 10px rgba(0,0,0,0.12)',
  8: '0 5px 5px -3px rgba(0,0,0,0.2), 0 8px 10px 1px rgba(0,0,0,0.14), 0 3px 14px 2px rgba(0,0,0,0.12)',
}

function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

// The color darkened just enough to read against white (4.5:1), for text in
// a widget's color and for white text on it.
export function ink(hex: string): string {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16))
  for (let factor = 1; factor > 0; factor -= 0.02) {
    const candidate = `#${channels
      .map(c =>
        Math.round(c * factor)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`
    if (contrast(candidate, '#ffffff') >= 4.5) return candidate
  }
  return '#000000'
}

// InstUI theme overrides for the dashboard. The global tokens (type, corners,
// shadows) flow into every component, including the widgets from
// @instructure/platform-widget-dashboard.
export function materialTheme(isDark: boolean) {
  const bar = ink(APP_BAR)
  return {
    typography: {fontFamily: ROBOTO},
    borders: {radiusSmall: '2px', radiusMedium: '2px', radiusLarge: '2px'},
    shadows: {
      depth1: ELEVATION[1],
      depth2: ELEVATION[2],
      depth3: ELEVATION[8],
      resting: ELEVATION[1],
      above: ELEVATION[2],
      topmost: ELEVATION[8],
      card: ELEVATION[2],
      cardHover: ELEVATION[8],
    },
    componentOverrides: {
      Heading: {
        h1FontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
        h1FontWeight: 300,
        h2FontSize: '1.75rem',
        h2FontWeight: 300,
        h3FontSize: '1.375rem',
        h3FontWeight: 400,
        lineHeight: 1.2,
      },
      Button: {
        borderRadius: '2px',
        fontWeight: 500,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        primaryBackground: bar,
        primaryBorderColor: bar,
        primaryHoverBackground: ink('#1d5f96'),
        primaryActiveBackground: bar,
        primaryBoxShadow: ELEVATION[2],
      },
      TextInput: {borderRadius: '2px'},
      TextArea: {borderRadius: '2px'},
      Tag: {defaultBorderRadius: '2px'},
      Modal: {borderRadius: '2px'},
      'Modal.Footer': {borderRadius: '2px'},
      // the tabs sit on the colored app bar, in white
      Tabs: {defaultBackground: bar, scrollFadeColor: bar},
      'Tabs.Tab': {
        defaultColor: '#ffffff',
        defaultSelectedBorderColor: '#ffffff',
        defaultHoverBorderColor: 'rgba(255,255,255,0.5)',
        fontWeight: 500,
        fontSize: '0.875rem',
      },
      ...(isDark ? {} : {'Tabs.Panel': {background: SURFACE}}),
    },
  }
}

// What the theme can't reach: a colored top edge and title for each widget
// (the color comes from --sp-accent on the widget's wrapper), uppercase tabs
// and the page's grey surface.
export const MATERIAL_CSS = `
.sp-material-home {
  font-family: ${ROBOTO};
}
.sp-material-home [role="tablist"] [role="tab"] {
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.sp-material-home [data-sp-accent] > section,
.sp-material-home [data-sp-accent] section[data-testid^="widget-"] {
  border-top: 4px solid var(--sp-accent);
}
.sp-material-home [data-sp-accent] section[data-testid^="widget-"] h2 {
  color: var(--sp-accent-ink);
}
.sp-material-home:not(.sp-material-home--dark) [data-sp-accent] section[data-testid^="widget-"] {
  background: #FFFFFF;
}
.sp-material-home--dark [data-sp-accent] section[data-testid^="widget-"] h2 {
  color: inherit;
}
`
