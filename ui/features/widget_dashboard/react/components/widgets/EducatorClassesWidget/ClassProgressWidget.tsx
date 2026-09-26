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

import React from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {TemplateWidget} from '@instructure/platform-widget-dashboard'
import {Link} from '@instructure/ui-link'
import {List} from '@instructure/ui-list'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import type {BaseWidgetProps} from '../../../types'
import {reasonsFor, useClassRoster} from '../../../hooks/useClassRoster'

const I18n = createI18nScope('widget_dashboard')

// One row per class: how far along it is on average, and how many students
// need attention. Each links to that class's students.
const ClassProgressWidget: React.FC<BaseWidgetProps> = ({
  widget,
  isEditMode = false,
  dragHandleProps,
}) => {
  const {data: rows = [], isLoading, error, refetch} = useClassRoster()
  const now = new Date()
  const byCourse = new Map<
    string,
    {name: string; students: number; total: number; attention: number}
  >()
  rows.forEach(row => {
    const entry = byCourse.get(row.course.id) ?? {
      name: row.course.name,
      students: 0,
      total: 0,
      attention: 0,
    }
    entry.students += 1
    entry.total += row.percent_complete
    if (reasonsFor(row, now).length > 0) entry.attention += 1
    byCourse.set(row.course.id, entry)
  })
  const classes = [...byCourse.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))

  return (
    <TemplateWidget
      widget={widget}
      isEditMode={isEditMode}
      dragHandleProps={dragHandleProps}
      isLoading={isLoading}
      error={error ? I18n.t("Your classes didn't load.") : null}
      onRetry={() => refetch()}
      loadingText={I18n.t('Loading your classes...')}
    >
      {classes.length === 0 ? (
        <Text color="secondary" data-testid="class-progress-empty">
          {I18n.t('No students are in your self-paced classes yet.')}
        </Text>
      ) : (
        <List isUnstyled margin="0" itemSpacing="small">
          {classes.map(([id, entry]) => {
            const percent = Math.round(entry.total / entry.students)
            return (
              <List.Item key={id}>
                <Link href={`/self_paced/dashboard?course_id=${id}`} isWithinText={false}>
                  <Text weight="bold">{entry.name}</Text>
                </Link>
                <div
                  role="meter"
                  aria-label={I18n.t('Average progress in %{course}', {course: entry.name})}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  style={{
                    height: 6,
                    margin: '6px 0',
                    background: 'rgba(0,0,0,0.12)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${percent}%`,
                      height: '100%',
                      background: 'var(--sp-accent, #2a78d6)',
                    }}
                  />
                </div>
                <View as="div">
                  <Text size="small" color="secondary">
                    {I18n.t('%{percent}% done on average, %{students} students', {
                      percent,
                      students: entry.students,
                    })}
                    {entry.attention > 0
                      ? ` · ${I18n.t('%{count} need attention', {count: entry.attention})}`
                      : ''}
                  </Text>
                </View>
              </List.Item>
            )
          })}
        </List>
      )}
    </TemplateWidget>
  )
}

export default ClassProgressWidget
