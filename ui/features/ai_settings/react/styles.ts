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

import type React from 'react'
import {APP_BAR, ELEVATION, ink, ROBOTO} from '../../self_paced_home/react/material'

export const card: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 2,
  boxShadow: ELEVATION[2],
  padding: 'clamp(14px, 3vw, 20px)',
  fontFamily: ROBOTO,
  minWidth: 0,
}

export const field: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 44,
  padding: '10px 12px',
  margin: '4px 0 8px',
  border: '1px solid #9E9E9E',
  borderRadius: 2,
  font: 'inherit',
  fontSize: '1rem',
  background: '#fff',
}

export const raised: React.CSSProperties = {
  minHeight: 44,
  padding: '0 20px',
  border: 'none',
  borderRadius: 2,
  background: ink(APP_BAR),
  color: '#fff',
  font: 'inherit',
  fontWeight: 500,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: ELEVATION[2],
}

export const flat: React.CSSProperties = {
  ...raised,
  background: 'transparent',
  color: ink(APP_BAR),
  boxShadow: 'none',
  padding: '0 12px',
}

export const cardTitle: React.CSSProperties = {
  margin: '0 0 8px',
  fontWeight: 400,
  fontSize: '1.125rem',
}

export const pill: React.CSSProperties = {
  display: 'inline-block',
  borderRadius: 2,
  padding: '2px 8px',
  fontSize: '0.75rem',
  fontWeight: 500,
}
