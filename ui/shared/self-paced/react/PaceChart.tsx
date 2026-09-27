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

import React, {useLayoutEffect, useMemo, useRef, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {dayNumber, formatPlanDate, valueOn, type ChartPoint, type Pacing} from '../pacing'

const I18n = createI18nScope('self_paced_pacing')

const INK = {primary: '#0b0b0b', secondary: '#52514e', muted: '#6b6a65', grid: '#e1e0d9'}
// The plan is a reference line, not a category: neutral and dashed.
const PLAN_COLOR = '#898781'

const MARGIN = {top: 20, right: 12, bottom: 24, left: 40}

type Props = {
  chart: Pacing['chart']
  color: string // the course color, for the student's own lines
  height?: number
  title: string
}

type Hover = {day: number; x: number}

// Planned vs actual progress (docs/fork-plan.md §2.3): the baseline plan, the
// student's progress so far, and the current plan from today to the target.
// One y axis (percent of the course's work); hover shows the day's values; a
// table carries the same numbers for screen readers.
export default function PaceChart({chart, color, height = 180, title}: Props) {
  const wrapper = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(560)
  const [hover, setHover] = useState<Hover | null>(null)

  useLayoutEffect(() => {
    const node = wrapper.current
    if (!node) return
    const measure = () => setWidth(Math.max(240, node.clientWidth || 560))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const domain = useMemo(() => {
    const days = [...chart.baseline, ...chart.actual, ...chart.projected].map(([date]) =>
      dayNumber(date),
    )
    days.push(dayNumber(chart.today))
    return {min: Math.min(...days), max: Math.max(...days)}
  }, [chart])

  const plotWidth = width - MARGIN.left - MARGIN.right
  const plotHeight = height - MARGIN.top - MARGIN.bottom
  const span = Math.max(1, domain.max - domain.min)
  const x = (day: number) => MARGIN.left + ((day - domain.min) / span) * plotWidth
  const y = (percent: number) => MARGIN.top + (1 - percent / 100) * plotHeight
  const path = (series: ChartPoint[]) =>
    series
      .map(
        ([date, percent], i) =>
          `${i ? 'L' : 'M'}${x(dayNumber(date)).toFixed(1)},${y(percent).toFixed(1)}`,
      )
      .join(' ')

  const todayX = x(dayNumber(chart.today))
  const lastActual = chart.actual[chart.actual.length - 1]
  const firstProjected = chart.projected[0]

  const onMouseMove = (event: React.MouseEvent<SVGRectElement>) => {
    const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    const px = Math.min(Math.max(event.clientX - rect.left, MARGIN.left), MARGIN.left + plotWidth)
    const day = Math.round(domain.min + ((px - MARGIN.left) / plotWidth) * span)
    setHover({day, x: x(day)})
  }

  const hoverIso = hover ? isoFromDay(hover.day) : null
  const hoverValues = hoverIso
    ? {
        actual:
          lastActual && hover!.day <= dayNumber(lastActual[0])
            ? valueOn(chart.actual, hoverIso)
            : null,
        plan: valueOn(chart.baseline, hoverIso),
        projected:
          firstProjected && hover!.day >= dayNumber(firstProjected[0])
            ? valueOn(chart.projected, hoverIso)
            : null,
      }
    : null

  return (
    <figure style={{margin: 0}}>
      <figcaption style={{display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: '0 0 8px'}}>
        <span style={{fontWeight: 500, color: INK.primary, marginRight: 8}}>{title}</span>
        <LegendItem color={color} label={I18n.t('Your progress')} />
        <LegendItem color={PLAN_COLOR} dash="6 4" label={I18n.t('Original plan')} />
        <LegendItem color={color} dash="2 4" label={I18n.t('Plan from today')} />
      </figcaption>
      <div ref={wrapper} style={{position: 'relative', width: '100%'}}>
        <svg width={width} height={height} aria-hidden="true" style={{display: 'block'}}>
          {[0, 50, 100].map(percent => (
            <g key={percent}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + plotWidth}
                y1={y(percent)}
                y2={y(percent)}
                stroke={INK.grid}
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 6}
                y={y(percent)}
                dy="0.32em"
                textAnchor="end"
                fontSize="11"
                fill={INK.muted}
              >
                {`${percent}%`}
              </text>
            </g>
          ))}
          <text x={MARGIN.left} y={height - 6} fontSize="11" fill={INK.muted}>
            {formatPlanDate(isoFromDay(domain.min), {month: 'short', day: 'numeric'})}
          </text>
          <text
            x={MARGIN.left + plotWidth}
            y={height - 6}
            fontSize="11"
            fill={INK.muted}
            textAnchor="end"
          >
            {formatPlanDate(isoFromDay(domain.max), {month: 'short', day: 'numeric'})}
          </text>

          <line
            x1={todayX}
            x2={todayX}
            y1={MARGIN.top - 6}
            y2={MARGIN.top + plotHeight}
            stroke={INK.secondary}
            strokeWidth={1}
          />
          <text
            x={todayX}
            y={MARGIN.top - 9}
            fontSize="11"
            fill={INK.secondary}
            textAnchor="middle"
          >
            {I18n.t('Today')}
          </text>

          <path
            d={path(chart.baseline)}
            fill="none"
            stroke={PLAN_COLOR}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          {chart.projected.length > 1 && (
            <path
              d={path(chart.projected)}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="2 4"
              strokeLinecap="round"
            />
          )}
          {chart.actual.length > 1 && (
            <path
              d={path(chart.actual)}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          )}
          {lastActual && (
            <circle
              cx={x(dayNumber(lastActual[0]))}
              cy={y(lastActual[1])}
              r={4}
              fill={color}
              stroke="#fff"
              strokeWidth={2}
            />
          )}

          {hover && (
            <line
              x1={hover.x}
              x2={hover.x}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              stroke={INK.secondary}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          )}
          <rect
            data-testid="pace-chart-hit"
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onMouseMove={onMouseMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
        {hover && hoverValues && hoverIso && (
          <div
            data-testid="pace-chart-tip"
            style={{
              position: 'absolute',
              top: 0,
              left: Math.min(Math.max(hover.x + 12, 0), width - 180),
              width: 168,
              padding: '8px 10px',
              background: '#fff',
              borderRadius: 2,
              boxShadow: '0 2px 5px rgba(0,0,0,0.26), 0 2px 10px rgba(0,0,0,0.16)',
              fontSize: '0.8125rem',
              color: INK.primary,
              pointerEvents: 'none',
            }}
          >
            <div style={{fontWeight: 500, marginBottom: 4}}>{formatPlanDate(hoverIso)}</div>
            {hoverValues.actual !== null && (
              <TipRow label={I18n.t('Your progress')} value={hoverValues.actual} />
            )}
            {hoverValues.plan !== null && (
              <TipRow label={I18n.t('Original plan')} value={hoverValues.plan} />
            )}
            {hoverValues.projected !== null && (
              <TipRow label={I18n.t('Plan from today')} value={hoverValues.projected} />
            )}
          </div>
        )}
      </div>
      <ScreenReaderContent>
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">{I18n.t('Date')}</th>
              <th scope="col">{I18n.t('Original plan')}</th>
              <th scope="col">{I18n.t('Your progress')}</th>
            </tr>
          </thead>
          <tbody>
            {tableDates(chart).map(date => (
              <tr key={date}>
                <th scope="row">{formatPlanDate(date)}</th>
                <td>{formatPercent(valueOn(chart.baseline, date))}</td>
                <td>
                  {lastActual && dayNumber(date) <= dayNumber(lastActual[0])
                    ? formatPercent(valueOn(chart.actual, date))
                    : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScreenReaderContent>
    </figure>
  )
}

function LegendItem({color, label, dash}: {color: string; label: string; dash?: string}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: INK.secondary,
        fontSize: '0.8125rem',
      }}
    >
      <svg width="20" height="8" aria-hidden="true">
        <line
          x1="1"
          x2="19"
          y1="4"
          y2="4"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      </svg>
      {label}
    </span>
  )
}

function TipRow({label, value}: {label: string; value: number}) {
  return (
    <div style={{display: 'flex', justifyContent: 'space-between', gap: 8}}>
      <span style={{color: INK.secondary}}>{label}</span>
      <span style={{fontVariantNumeric: 'tabular-nums'}}>{formatPercent(value)}</span>
    </div>
  )
}

function formatPercent(value: number | null): string {
  return value === null ? '–' : `${Math.round(value)}%`
}

function isoFromDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10)
}

// About one row a week, plus today, so the table stays readable.
export function tableDates(chart: Pacing['chart']): string[] {
  const weekly = chart.baseline.filter((_, i) => i % 5 === 0).map(([date]) => date)
  const last = chart.baseline[chart.baseline.length - 1]?.[0]
  const dates = new Set([...weekly, ...(last ? [last] : []), chart.today])
  return [...dates].sort((a, b) => dayNumber(a) - dayNumber(b))
}
