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

import React, {useCallback, useEffect, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {Button} from '@instructure/ui-buttons'
import {INK} from './colors'
import {Card, DIVIDER, Pill} from './material'
import type {RowKey} from './types'
import {ACCENT_TEXT} from '@canvas/material'

const I18n = createI18nScope('self_paced_dashboard')

type AlertJson = {
  id: string
  kind: string
  description: string
  opened_at: string
  student: {id: string; name: string}
  course: {id: string; name: string}
  item: {id: string; title: string} | null
}

type Rule = {kind: string; threshold: number | null; enabled: boolean; notify: boolean}

// What each kind of rule counts, for its number field.
const RULES: Record<string, {label: () => string; unit: (() => string) | null}> = {
  behind: {label: () => I18n.t('Behind pace'), unit: () => I18n.t('days behind')},
  stuck: {label: () => I18n.t('Stuck on an item'), unit: () => I18n.t('tries')},
  max_attempts: {label: () => I18n.t('Out of tries on an item'), unit: null},
  inactive: {label: () => I18n.t('Inactive'), unit: () => I18n.t('days without activity')},
  low_grade: {label: () => I18n.t('Low grade'), unit: () => I18n.t('percent or lower')},
}

// The class's open alerts (Phase 6), and for people who can grade, the rules
// that raise them.
export default function AlertsPanel({
  courseId,
  alertsUrl,
  rulesUrl,
  canEditRules,
  onOpenStudent,
}: {
  courseId: string
  alertsUrl: string
  rulesUrl: string
  canEditRules: boolean
  onOpenStudent: (key: RowKey) => void
}) {
  const [alerts, setAlerts] = useState<AlertJson[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const load = useCallback(async () => {
    try {
      const {json} = await doFetchApi<{alerts: AlertJson[]}>({
        path: `${alertsUrl}?course_id=${encodeURIComponent(courseId)}`,
      })
      setAlerts(json?.alerts ?? [])
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [alertsUrl, courseId])

  useEffect(() => {
    load()
  }, [load])

  const dismiss = async (alert: AlertJson) => {
    setAlerts(current => (current ?? []).filter(a => a.id !== alert.id))
    try {
      await doFetchApi({path: `${alertsUrl}/${alert.id}/dismiss`, method: 'PUT'})
    } catch {
      load()
    }
  }

  return (
    <Card
      title={I18n.t('Alerts')}
      labelledBy="self-paced-course-alerts"
      aside={
        canEditRules ? (
          <Button
            size="small"
            withBackground={false}
            onClick={() => setShowRules(show => !show)}
            aria-expanded={showRules}
          >
            {showRules ? I18n.t('Hide rules') : I18n.t('Alert rules')}
          </Button>
        ) : undefined
      }
    >
      {showRules && <RulesEditor url={rulesUrl} onSaved={load} />}
      {failed && <span role="alert">{I18n.t("Alerts didn't load.")}</span>}
      {!failed && alerts && alerts.length === 0 && (
        <span style={{color: INK.secondary}}>
          {I18n.t('No open alerts. Nobody in this class needs you right now.')}
        </span>
      )}
      <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
        {(alerts ?? []).map(alert => (
          <li
            key={alert.id}
            style={{display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0'}}
          >
            <div style={{flex: 1, minWidth: 0}}>
              <Button
                size="small"
                withBackground={false}
                color="primary"
                themeOverride={{
                  primaryGhostColor: ACCENT_TEXT,
                  primaryGhostBorderColor: ACCENT_TEXT,
                }}
                onClick={() =>
                  onOpenStudent({courseId: alert.course.id, studentId: alert.student.id})
                }
              >
                {alert.student.name}
              </Button>{' '}
              <Pill>{RULES[alert.kind]?.label() ?? alert.kind}</Pill>
              <div style={{color: INK.secondary, fontSize: '0.875rem'}}>
                {alert.description}
                {alert.item ? ` · ${alert.item.title}` : ''}
              </div>
            </div>
            <Button size="small" onClick={() => dismiss(alert)}>
              {I18n.t('Dismiss')}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function RulesEditor({url, onSaved}: {url: string; onSaved: () => void}) {
  const [rules, setRules] = useState<Rule[] | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    doFetchApi<{rules: Rule[]}>({path: url})
      .then(({json}) => setRules(json?.rules ?? []))
      .catch(() => setMessage(I18n.t("Rules didn't load.")))
  }, [url])

  const change = (kind: string, patch: Partial<Rule>) =>
    setRules(current => (current ?? []).map(r => (r.kind === kind ? {...r, ...patch} : r)))

  const save = async () => {
    setMessage('')
    try {
      const {json} = await doFetchApi<{rules: Rule[]}>({
        path: url,
        method: 'PUT',
        body: {rules},
      })
      setRules(json?.rules ?? rules)
      setMessage(I18n.t('Saved.'))
      onSaved()
    } catch {
      setMessage(I18n.t("Rules didn't save. Check the numbers and try again."))
    }
  }

  if (!rules) return message ? <span role="alert">{message}</span> : null
  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        save()
      }}
      style={{borderBottom: `1px solid ${DIVIDER}`, paddingBottom: 12, marginBottom: 8}}
    >
      {rules.map(rule => {
        const spec = RULES[rule.kind]
        return (
          <div
            key={rule.kind}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '4px 0',
              flexWrap: 'wrap',
            }}
          >
            <label style={{minWidth: '12rem'}}>
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={event => change(rule.kind, {enabled: event.target.checked})}
              />{' '}
              {spec.label()}
            </label>
            {spec.unit && (
              <label>
                <input
                  type="number"
                  min={1}
                  max={rule.kind === 'low_grade' ? 100 : 365}
                  value={rule.threshold ?? ''}
                  disabled={!rule.enabled}
                  aria-label={`${spec.label()}: ${spec.unit()}`}
                  onChange={event =>
                    change(rule.kind, {threshold: Number(event.target.value) || null})
                  }
                  style={{width: '5rem'}}
                />{' '}
                {spec.unit()}
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={rule.notify}
                disabled={!rule.enabled}
                onChange={event => change(rule.kind, {notify: event.target.checked})}
              />{' '}
              {I18n.t('Send a notification')}
            </label>
          </div>
        )
      })}
      <Button type="submit" color="primary" size="small" margin="small 0 0">
        {I18n.t('Save rules')}
      </Button>{' '}
      <span role="status">{message}</span>
    </form>
  )
}
