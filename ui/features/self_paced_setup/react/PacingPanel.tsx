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
import {Alert} from '@instructure/ui-alerts'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {Button, IconButton} from '@instructure/ui-buttons'
import {Heading} from '@instructure/ui-heading'
import {IconTrashLine} from '@instructure/ui-icons'
import {NumberInput} from '@instructure/ui-number-input'
import {Text} from '@instructure/ui-text'
import {TextInput} from '@instructure/ui-text-input'
import {View} from '@instructure/ui-view'
import {formatPlanDate} from '@canvas/self-paced/pacing'
import {INK as THEME_INK, PAPER} from '@canvas/material'

const I18n = createI18nScope('self_paced_setup')

// Shape of GET/PUT /api/v1/courses/:course_id/self_paced/calendar (SelfPaced::PacingController)
export type BlackoutDate = {
  id: string | null
  title: string
  start_date: string
  end_date: string
  source: 'course' | 'account' | 'calendar'
}

export type PacingCalendar = {
  account: {id: string; name: string}
  weekday_minutes: number[] // Sunday first
  date_minutes: Record<string, number>
  can_edit_calendar: boolean
  target_date: string | null
  course_end_date: string | null
  blackout_dates: BlackoutDate[]
  blackout_dates_url: string
}

// Monday first, the way schools read a week; values index weekday_minutes.
const WEEK = [1, 2, 3, 4, 5, 6, 0]

function weekdayName(index: number): string {
  // 2026-10-04 was a Sunday
  return new Date(2026, 9, 4 + index).toLocaleDateString(undefined, {weekday: 'long'})
}

const DATE_INPUT_STYLE = {
  padding: '6px 8px',
  border: '1px solid #6b6a65',
  borderRadius: 2,
  font: 'inherit',
}

// Pacing settings on the setup screen (docs/fork-plan.md §2.3): the date
// students aim to finish by, the school's teaching days, and days off.
export default function PacingPanel({url}: {url: string}) {
  const [calendar, setCalendar] = useState<PacingCalendar | null>(null)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{variant: 'success' | 'error'; text: string} | null>(null)
  const [newDayOff, setNewDayOff] = useState({title: '', start: '', end: ''})

  const load = async () => {
    try {
      const {json} = await doFetchApi<PacingCalendar>({path: url})
      if (json) setCalendar(json)
      else setFailed(true)
    } catch {
      setFailed(true)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  if (failed) {
    return (
      <Text color="danger">
        {I18n.t("The pacing settings didn't load. Reload the page to try again.")}
      </Text>
    )
  }
  if (!calendar) return null

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const body: Record<string, unknown> = {target_date: calendar.target_date || ''}
      if (calendar.can_edit_calendar) {
        body.weekday_minutes = calendar.weekday_minutes
        body.date_minutes = calendar.date_minutes
      }
      const {json} = await doFetchApi<PacingCalendar>({path: url, method: 'PUT', body})
      if (json) setCalendar(json)
      setMessage({
        variant: 'success',
        text: I18n.t("Saved. Students' plans update in a minute or two."),
      })
    } catch {
      setMessage({
        variant: 'error',
        text: I18n.t("The pacing settings didn't save. Check the dates and try again."),
      })
    } finally {
      setSaving(false)
    }
  }

  const addDayOff = async () => {
    const {title, start, end} = newDayOff
    if (!title.trim() || !start) return
    try {
      await doFetchApi({
        path: calendar.blackout_dates_url,
        method: 'POST',
        body: {
          blackout_date: {event_title: title.trim(), start_date: start, end_date: end || start},
        },
      })
      setNewDayOff({title: '', start: '', end: ''})
      await load()
    } catch {
      setMessage({
        variant: 'error',
        text: I18n.t("The day off wasn't added. Check the dates and try again."),
      })
    }
  }

  const removeDayOff = async (id: string) => {
    try {
      await doFetchApi({path: `${calendar.blackout_dates_url}/${id}`, method: 'DELETE'})
      await load()
    } catch {
      setMessage({variant: 'error', text: I18n.t("The day off wasn't removed. Try again.")})
    }
  }

  const setMinutes = (weekday: number, value: string) => {
    const minutes = Math.max(0, Math.min(1440, Math.round(Number(value) || 0)))
    const next = [...calendar.weekday_minutes]
    next[weekday] = minutes
    setCalendar({...calendar, weekday_minutes: next})
  }

  const defaultFinish = calendar.course_end_date
    ? I18n.t('Leave it empty to use the course end date, %{date}.', {
        date: formatPlanDate(calendar.course_end_date),
      })
    : I18n.t('Leave it empty and each student gets a school year from the day they start.')

  return (
    <View
      as="section"
      margin="medium 0"
      padding="medium"
      background="primary"
      themeOverride={{backgroundPrimary: PAPER}}
      borderRadius="small"
      shadow="resting"
    >
      <Heading level="h2" margin="0 0 x-small">
        {I18n.t('Pacing')}
      </Heading>
      <Text as="p" color="secondary">
        {I18n.t(
          "Each student's work is spread over the school days between the day they start and the finish date. Their due dates follow their plan.",
        )}
      </Text>

      <div style={{display: 'flex', flexWrap: 'wrap', gap: 40, marginTop: 16}}>
        <div style={{flex: '1 1 16rem'}}>
          <label
            htmlFor="self-paced-finish-date"
            style={{display: 'block', fontWeight: 500, marginBottom: 4}}
          >
            {I18n.t('Finish date')}
          </label>
          <input
            id="self-paced-finish-date"
            type="date"
            value={calendar.target_date || ''}
            onChange={event => setCalendar({...calendar, target_date: event.target.value || null})}
            style={DATE_INPUT_STYLE}
          />
          <Text as="p" size="small" color="secondary">
            {defaultFinish}{' '}
            {I18n.t(
              'Mentors and teachers can give a student their own date from the Students page.',
            )}
          </Text>
        </div>

        <fieldset style={{flex: '1 1 18rem', border: 0, margin: 0, padding: 0}}>
          <legend style={{fontWeight: 500, marginBottom: 4, padding: 0}}>
            {I18n.t('Minutes of school each day')}
          </legend>
          <Text as="p" size="small" color="secondary">
            {calendar.can_edit_calendar
              ? I18n.t('Applies to every course in %{school}. 0 means no school that day.', {
                  school: calendar.account.name,
                })
              : I18n.t('Set for all of %{school}. Ask an admin to change it.', {
                  school: calendar.account.name,
                })}
          </Text>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '8rem 7rem',
              gap: '4px 12px',
              alignItems: 'center',
            }}
          >
            {WEEK.map(weekday => (
              <React.Fragment key={weekday}>
                <span>{weekdayName(weekday)}</span>
                <NumberInput
                  renderLabel={
                    <ScreenReaderContent>
                      {I18n.t('Minutes on %{day}', {day: weekdayName(weekday)})}
                    </ScreenReaderContent>
                  }
                  showArrows={false}
                  width="6rem"
                  interaction={calendar.can_edit_calendar ? 'enabled' : 'readonly'}
                  value={String(calendar.weekday_minutes[weekday] ?? 0)}
                  onChange={(_e, value) => setMinutes(weekday, value)}
                />
              </React.Fragment>
            ))}
          </div>
        </fieldset>
      </div>

      <Heading level="h3" margin="medium 0 x-small">
        {I18n.t('Days off')}
      </Heading>
      {calendar.blackout_dates.length === 0 ? (
        <Text as="p" color="secondary">
          {I18n.t('No days off yet. Add holidays and breaks so plans skip them.')}
        </Text>
      ) : (
        <ul style={{listStyle: 'none', margin: '0 0 12px', padding: 0}}>
          {calendar.blackout_dates.map(day => (
            <li
              key={`${day.source}-${day.id ?? day.title}-${day.start_date}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '4px 0',
                borderBottom: '1px solid #e1e0d9',
              }}
            >
              <span style={{flex: 1}}>
                <span style={{fontWeight: 500}}>{day.title}</span>{' '}
                <span style={{color: THEME_INK.secondary}}>
                  {day.start_date === day.end_date
                    ? formatPlanDate(day.start_date)
                    : I18n.t('%{start} to %{end}', {
                        start: formatPlanDate(day.start_date),
                        end: formatPlanDate(day.end_date),
                      })}
                </span>
              </span>
              {day.source === 'course' && day.id ? (
                <IconButton
                  size="small"
                  withBackground={false}
                  withBorder={false}
                  renderIcon={<IconTrashLine />}
                  screenReaderLabel={I18n.t('Remove %{title}', {title: day.title})}
                  onClick={() => removeDayOff(day.id!)}
                />
              ) : (
                <Text size="small" color="secondary">
                  {I18n.t('Set by the school')}
                </Text>
              )}
            </li>
          ))}
        </ul>
      )}
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end'}}>
        <div style={{width: '14rem'}}>
          <TextInput
            renderLabel={I18n.t('Name')}
            placeholder={I18n.t('Thanksgiving break')}
            value={newDayOff.title}
            onChange={(_e, value) => setNewDayOff({...newDayOff, title: value})}
          />
        </div>
        <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 500}}>
          {I18n.t('From')}
          <input
            type="date"
            value={newDayOff.start}
            onChange={event => setNewDayOff({...newDayOff, start: event.target.value})}
            style={DATE_INPUT_STYLE}
          />
        </label>
        <label style={{display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 500}}>
          {I18n.t('To')}
          <input
            type="date"
            value={newDayOff.end}
            min={newDayOff.start || undefined}
            onChange={event => setNewDayOff({...newDayOff, end: event.target.value})}
            style={DATE_INPUT_STYLE}
          />
        </label>
        <Button
          onClick={addDayOff}
          interaction={newDayOff.title.trim() && newDayOff.start ? 'enabled' : 'disabled'}
        >
          {I18n.t('Add day off')}
        </Button>
      </div>

      <div style={{marginTop: 20}}>
        <Button color="primary" onClick={save} interaction={saving ? 'disabled' : 'enabled'}>
          {saving ? I18n.t('Saving…') : I18n.t('Save pacing')}
        </Button>
      </div>
      {message && (
        <Alert
          variant={message.variant}
          margin="small 0"
          liveRegion={() => document.getElementById('flash_screenreader_holder')}
        >
          {message.text}
        </Alert>
      )}
    </View>
  )
}
