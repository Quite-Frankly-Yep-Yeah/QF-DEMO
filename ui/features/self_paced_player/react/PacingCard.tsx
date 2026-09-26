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

import React, {useEffect, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {tint} from '@canvas/self-paced/player'
import {
  dayNumber,
  formatMinutes,
  formatPlanDate,
  type Pacing,
  type PacingItem,
} from '@canvas/self-paced/pacing'
import PaceBadge from '@canvas/self-paced/react/PaceBadge'
import PaceChart from '@canvas/self-paced/react/PaceChart'

const I18n = createI18nScope('self_paced_player')

const INK = {primary: '#0b0b0b', secondary: '#52514e', muted: '#6b6a65', line: '#e1e0d9'}
const ROBOTO = "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"
// Material 1 card
const CARD = {
  background: '#FFFFFF',
  borderRadius: 2,
  boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
  padding: 24,
  margin: '0 0 24px',
  fontFamily: ROBOTO,
}

// The student's pacing on the course map (docs/fork-plan.md §2.3): where they
// stand, what's planned for today and the rest of the week, and their progress
// against the plan.
export default function PacingCard({url, color}: {url: string; color: string}) {
  const [pacing, setPacing] = useState<Pacing | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    doFetchApi<Pacing>({path: url})
      .then(({json}) => {
        if (cancelled) return
        if (json?.chart) setPacing(json)
        else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (failed) {
    return (
      <section style={CARD} aria-label={I18n.t('Your pace')}>
        <span style={{color: INK.secondary}}>
          {I18n.t("Your plan didn't load. Reload the page to try again.")}
        </span>
      </section>
    )
  }
  if (!pacing) return null

  const today = pacing.chart.today
  const todayItems = pacing.items.filter(
    item => item.planned_date && dayNumber(item.planned_date) <= dayNumber(today),
  )
  const laterItems = pacing.items.filter(
    item => item.planned_date && dayNumber(item.planned_date) > dayNumber(today),
  )
  const doneForToday = pacing.today.total > 0 && pacing.today.done >= pacing.today.total

  return (
    <section style={CARD} aria-labelledby="self-paced-pace-heading">
      <h2 id="self-paced-pace-heading" style={{margin: 0}}>
        <ScreenReaderContent>{I18n.t('Your pace')}</ScreenReaderContent>
        <PaceBadge daysAhead={pacing.days_ahead} finished={pacing.finished} size="large" />
      </h2>
      <p style={{margin: '8px 0 0', color: INK.secondary}}>
        {pacing.finished
          ? I18n.t("You've finished all the work in this course.")
          : I18n.t('Finish by %{date}. That’s about %{minutes} a school day.', {
              date: formatPlanDate(pacing.target_date, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
              minutes: formatMinutes(pacing.daily_minutes),
            })}
      </p>

      {!pacing.finished && (
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 32, margin: '24px 0'}}>
          <section
            aria-labelledby="self-paced-today-heading"
            style={{flex: '1 1 18rem', minWidth: 0}}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12}}>
              <GoalRing done={pacing.today.done} total={pacing.today.total} color={color} />
              <div>
                <h3
                  id="self-paced-today-heading"
                  style={{margin: 0, fontSize: '1.125rem', fontWeight: 500, color: INK.primary}}
                >
                  {I18n.t('Today')}
                </h3>
                <div style={{color: INK.secondary}}>
                  {pacing.today.total === 0
                    ? I18n.t('Nothing planned. Get ahead with your next step.')
                    : doneForToday
                      ? I18n.t('Done for today. Keep going to get ahead.')
                      : I18n.t('%{done} of %{total} done, about %{minutes}', {
                          done: pacing.today.done,
                          total: pacing.today.total,
                          minutes: formatMinutes(pacing.today.minutes),
                        })}
                </div>
              </div>
            </div>
            <ItemList items={todayItems} today={today} color={color} />
          </section>

          <section
            aria-labelledby="self-paced-week-heading"
            style={{flex: '1 1 14rem', minWidth: 0}}
          >
            <h3
              id="self-paced-week-heading"
              style={{margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 500, color: INK.primary}}
            >
              {I18n.t('This week')}
            </h3>
            <div style={{color: INK.secondary, marginBottom: 12}}>
              {I18n.t('%{done} of %{total} done', {
                done: pacing.week.done,
                total: pacing.week.total,
              })}
            </div>
            {laterItems.length > 0 ? (
              <ItemList items={laterItems} today={today} color={color} showDay={true} />
            ) : (
              <div style={{color: INK.muted}}>{I18n.t('Nothing else planned this week.')}</div>
            )}
          </section>
        </div>
      )}

      <PaceChart chart={pacing.chart} color={color} title={I18n.t('Your progress')} />
    </section>
  )
}

// Today's goal as a ring in the course color.
function GoalRing({done, total, color}: {done: number; total: number; color: string}) {
  const size = 56
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const share = total > 0 ? Math.min(1, done / total) : 1
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{flexShrink: 0}}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={tint(color, 0.18)}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference * share} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dy="0.35em"
        textAnchor="middle"
        fontSize="15"
        fontWeight="500"
        fill={INK.primary}
      >
        {total > 0 ? `${done}/${total}` : '✓'}
      </text>
    </svg>
  )
}

function ItemList({
  items,
  today,
  color,
  showDay = false,
}: {
  items: PacingItem[]
  today: string
  color: string
  showDay?: boolean
}) {
  if (items.length === 0) return null
  return (
    <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
      {items.map(item => {
        const overdue =
          !item.completed && item.planned_date && dayNumber(item.planned_date) < dayNumber(today)
        return (
          <li
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 0',
              borderBottom: `1px solid ${INK.line}`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: item.completed ? color : 'transparent',
                boxShadow: item.completed ? 'none' : `inset 0 0 0 2px ${tint(color, 0.5)}`,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {item.completed ? '✓' : ''}
            </span>
            <a
              href={item.url}
              style={{
                flex: 1,
                minWidth: 0,
                color: item.completed ? INK.secondary : INK.primary,
                textDecoration: item.completed ? 'line-through' : 'none',
              }}
            >
              {item.title}
            </a>
            <ScreenReaderContent>
              {item.completed ? I18n.t('done') : I18n.t('not done yet')}
            </ScreenReaderContent>
            {(showDay || overdue) && item.planned_date && (
              <span
                style={{
                  color: overdue ? '#9e1f1f' : INK.muted,
                  fontSize: '0.8125rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {overdue
                  ? I18n.t('from %{day}', {
                      day: formatPlanDate(item.planned_date, {weekday: 'short'}),
                    })
                  : formatPlanDate(item.planned_date, {weekday: 'short'})}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
