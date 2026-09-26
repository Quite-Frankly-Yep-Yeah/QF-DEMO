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

import React, {useEffect, useMemo, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {Alert} from '@instructure/ui-alerts'
import {Button} from '@instructure/ui-buttons'
import {Checkbox} from '@instructure/ui-checkbox'
import {Heading} from '@instructure/ui-heading'
import {NumberInput} from '@instructure/ui-number-input'
import {SimpleSelect} from '@instructure/ui-simple-select'
import {Spinner} from '@instructure/ui-spinner'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import PacingPanel from './PacingPanel'

const I18n = createI18nScope('self_paced_setup')

// Shapes of GET/PUT /api/v1/courses/:course_id/self_paced/setup (SelfPaced::CourseSetup)
export type Role = 'instruction' | 'practice' | 'check' | 'pretest' | 'none'

export type SetupItem = {
  id: string
  title: string
  type: string
  scoreable: boolean
  role: Role
  estimated_minutes: number | null
  suggested_minutes?: number | null // the estimate used when estimated_minutes is empty
  mastery_threshold: number | null
  watch_fraction: number | null
  max_attempts: number | null
  retake_review: boolean
}

export type Setup = {
  mastery_threshold: number
  provisional_checks: boolean
  modules: {id: string; name: string; items: SetupItem[]}[]
}

type Config = {setup_url: string; player_url: string; calendar_url?: string | null}

const ROLE_OPTIONS: {value: Role; label: () => string}[] = [
  {value: 'instruction', label: () => I18n.t('Lesson')},
  {value: 'practice', label: () => I18n.t('Practice')},
  {value: 'check', label: () => I18n.t('Check (mastery)')},
  {value: 'pretest', label: () => I18n.t('Pretest')},
  {value: 'none', label: () => I18n.t('Not counted')},
]

const DEFAULT_WATCH_FRACTION = 0.95

// What quite frankly an example LMS will require for the item once saved, in the teacher's words.
// Mirrors SelfPaced::CourseSetup#requirement_for.
export function requirementPreview(item: SetupItem, courseThreshold: number): string | null {
  switch (item.role) {
    case 'instruction':
      return item.watch_fraction
        ? I18n.t('Watch %{percent}% of the video', {percent: Math.round(item.watch_fraction * 100)})
        : I18n.t('Open the page')
    case 'practice':
      return item.scoreable ? I18n.t('Submit it') : I18n.t('Open the page')
    case 'check':
    case 'pretest':
      return item.scoreable
        ? I18n.t('Score %{percent}% or more', {percent: item.mastery_threshold ?? courseThreshold})
        : I18n.t('Open the page')
    default:
      return null
  }
}

export default function SetupApp({config}: {config: Config}) {
  const [setup, setSetup] = useState<Setup | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{variant: 'success' | 'error'; text: string} | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const {json} = await doFetchApi<Setup>({path: config.setup_url})
        if (json) setSetup(json)
        else setLoadFailed(true)
      } catch {
        setLoadFailed(true)
      }
    }
    load()
  }, [config.setup_url])

  const itemCount = useMemo(
    () => setup?.modules.reduce((n, m) => n + m.items.length, 0) ?? 0,
    [setup],
  )

  const updateItem = (id: string, changes: Partial<SetupItem>) => {
    setSetup(
      current =>
        current && {
          ...current,
          modules: current.modules.map(m => ({
            ...m,
            items: m.items.map(item => (item.id === id ? {...item, ...changes} : item)),
          })),
        },
    )
  }

  const save = async () => {
    if (!setup) return
    setSaving(true)
    setMessage(null)
    try {
      const {json} = await doFetchApi<Setup>({
        path: config.setup_url,
        method: 'PUT',
        body: {
          mastery_threshold: setup.mastery_threshold,
          provisional_checks: setup.provisional_checks,
          items: setup.modules.flatMap(m =>
            m.items.map(item => ({
              id: item.id,
              role: item.role,
              estimated_minutes: item.estimated_minutes,
              mastery_threshold: item.mastery_threshold,
              watch_fraction: item.watch_fraction,
              max_attempts: item.max_attempts,
              retake_review: item.retake_review,
            })),
          ),
        },
      })
      if (json) setSetup(json)
      setMessage({
        variant: 'success',
        text: I18n.t('Saved. Modules now unlock in order using these rules.'),
      })
    } catch {
      setMessage({
        variant: 'error',
        text: I18n.t("The setup didn't save. Check your connection and try again."),
      })
    } finally {
      setSaving(false)
    }
  }

  if (loadFailed) {
    return (
      <Text color="danger">
        {I18n.t("The course player setup didn't load. Reload the page to try again.")}
      </Text>
    )
  }
  if (!setup) {
    return (
      <View as="div" textAlign="center" padding="xx-large">
        <Spinner renderTitle={I18n.t('Loading the course player setup')} />
      </View>
    )
  }

  return (
    <View as="div" padding="small 0 xx-large" maxWidth="64rem">
      <Heading level="h1" margin="0 0 x-small">
        {I18n.t('Course player setup')}
      </Heading>
      <Text as="p" color="secondary">
        {I18n.t(
          'Choose what each item is for. Saving turns these choices into module requirements, so students work through the course in order and a check has to be passed before they move on.',
        )}{' '}
        <a href={config.player_url}>{I18n.t('Preview the course map')}</a>
      </Text>

      <View
        as="section"
        margin="medium 0"
        padding="medium"
        background="primary"
        borderRadius="small"
        shadow="resting"
      >
        <Heading level="h2" margin="0 0 small">
          {I18n.t('Whole course')}
        </Heading>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start'}}>
          <div style={{width: '14rem'}}>
            <NumberInput
              renderLabel={I18n.t('Mastery threshold (%)')}
              value={String(setup.mastery_threshold)}
              onChange={(_e, value) => setSetup({...setup, mastery_threshold: Number(value) || 0})}
              onIncrement={() =>
                setSetup({...setup, mastery_threshold: Math.min(100, setup.mastery_threshold + 5)})
              }
              onDecrement={() =>
                setSetup({...setup, mastery_threshold: Math.max(5, setup.mastery_threshold - 5)})
              }
            />
          </div>
          <div style={{flex: '1 1 20rem', paddingTop: 28}}>
            <Checkbox
              variant="toggle"
              label={I18n.t('Let students continue while a check waits for grading')}
              checked={setup.provisional_checks}
              onChange={() => setSetup({...setup, provisional_checks: !setup.provisional_checks})}
            />
            <Text as="p" size="small" color="secondary">
              {I18n.t(
                "If the grade comes in below mastery, the items after the check lock again and the student's mentor is told.",
              )}
            </Text>
          </div>
        </div>
      </View>

      {config.calendar_url && <PacingPanel url={config.calendar_url} />}

      {setup.modules.map(mod => (
        <View key={mod.id} as="section" margin="large 0 0">
          <Heading level="h2" margin="0 0 small">
            {mod.name}
          </Heading>
          {mod.items.length === 0 ? (
            <Text color="secondary">{I18n.t('This module has no items.')}</Text>
          ) : (
            <ol style={{listStyle: 'none', margin: 0, padding: 0}}>
              {mod.items.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  courseThreshold={setup.mastery_threshold}
                  onChange={changes => updateItem(item.id, changes)}
                />
              ))}
            </ol>
          )}
        </View>
      ))}

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 24,
          padding: '12px 0',
          background: 'rgba(255,255,255,0.96)',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
          borderTop: '1px solid #e1e0d9',
        }}
      >
        <Button color="primary" onClick={save} interaction={saving ? 'disabled' : 'enabled'}>
          {saving ? I18n.t('Saving…') : I18n.t('Save and apply to modules')}
        </Button>
        <Text size="small" color="secondary">
          {I18n.t(
            {
              one: 'Saving rewrites the requirements and prerequisites of every module (1 item).',
              other:
                'Saving rewrites the requirements and prerequisites of every module (%{count} items).',
            },
            {count: itemCount},
          )}
        </Text>
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

function ItemRow({
  item,
  courseThreshold,
  onChange,
}: {
  item: SetupItem
  courseThreshold: number
  onChange: (changes: Partial<SetupItem>) => void
}) {
  if (item.type === 'ContextModuleSubHeader') {
    return <li style={{padding: '12px 0 4px', fontWeight: 500, color: '#52514e'}}>{item.title}</li>
  }

  const preview = requirementPreview(item, courseThreshold)
  const isCheck = item.role === 'check' || item.role === 'pretest'
  const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))

  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(12rem, 2fr) 11rem 7rem minmax(12rem, 2fr)',
        gap: 12,
        alignItems: 'start',
        padding: '10px 0',
        borderBottom: '1px solid #e1e0d9',
      }}
    >
      <div>
        <div style={{fontWeight: 500}}>{item.title}</div>
        {preview && (
          <div style={{fontSize: '0.8125rem', color: '#52514e', marginTop: 2}}>
            {I18n.t('Students must: %{rule}', {rule: preview})}
          </div>
        )}
      </div>
      <SimpleSelect
        renderLabel={
          <ScreenReaderContent>
            {I18n.t('Role for %{title}', {title: item.title})}
          </ScreenReaderContent>
        }
        value={item.role}
        onChange={(_e, {value}) => onChange({role: value as Role})}
      >
        {ROLE_OPTIONS.map(option => (
          <SimpleSelect.Option
            key={option.value}
            id={`${item.id}-${option.value}`}
            value={option.value}
          >
            {option.label()}
          </SimpleSelect.Option>
        ))}
      </SimpleSelect>
      <NumberInput
        renderLabel={
          <ScreenReaderContent>
            {I18n.t('Minutes for %{title}', {title: item.title})}
          </ScreenReaderContent>
        }
        placeholder={
          item.suggested_minutes
            ? I18n.t('%{minutes} min', {minutes: item.suggested_minutes})
            : I18n.t('min')
        }
        showArrows={false}
        value={item.estimated_minutes === null ? '' : String(item.estimated_minutes)}
        onChange={(_e, value) => onChange({estimated_minutes: numberOrNull(value)})}
      />
      <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
        {item.role === 'instruction' && (
          <Checkbox
            label={I18n.t('Must watch the video')}
            checked={!!item.watch_fraction}
            onChange={() =>
              onChange({watch_fraction: item.watch_fraction ? null : DEFAULT_WATCH_FRACTION})
            }
          />
        )}
        {isCheck && item.scoreable && (
          <>
            <div style={{display: 'flex', gap: 8}}>
              <NumberInput
                renderLabel={I18n.t('Threshold %')}
                placeholder={String(courseThreshold)}
                showArrows={false}
                width="6rem"
                value={item.mastery_threshold === null ? '' : String(item.mastery_threshold)}
                onChange={(_e, value) => onChange({mastery_threshold: numberOrNull(value)})}
              />
              <NumberInput
                renderLabel={I18n.t('Attempts')}
                placeholder={I18n.t('as is')}
                showArrows={false}
                width="6rem"
                value={item.max_attempts === null ? '' : String(item.max_attempts)}
                onChange={(_e, value) => onChange({max_attempts: numberOrNull(value)})}
              />
            </div>
            <Checkbox
              label={I18n.t('Review the lesson before each retake')}
              checked={item.retake_review}
              onChange={() => onChange({retake_review: !item.retake_review})}
            />
          </>
        )}
      </div>
    </li>
  )
}
