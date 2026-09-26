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
import {Pill} from '@instructure/ui-pill'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import type {BaseWidgetProps} from '../../../types'
import {reasonsFor, useClassRoster, type Reason} from '../../../hooks/useClassRoster'

const I18n = createI18nScope('widget_dashboard')
const SHOWN = 6

const LABEL: Record<Reason, () => string> = {
  stuck: () => I18n.t('Stuck'),
  behind: () => I18n.t('Behind pace'),
  inactive: () => I18n.t('Inactive'),
}
const COLOR: Record<Reason, 'danger' | 'warning' | 'info'> = {
  stuck: 'danger',
  behind: 'warning',
  inactive: 'info',
}

// Students who are stuck on an item, well behind their plan or haven't been
// active for a few days: most reasons first, each linking to their panel.
const StudentsNeedYouWidget: React.FC<BaseWidgetProps> = ({
  widget,
  isEditMode = false,
  dragHandleProps,
}) => {
  const {data: rows = [], isLoading, error, refetch} = useClassRoster()
  const now = new Date()
  const flagged = rows
    .map(row => ({row, reasons: reasonsFor(row, now)}))
    .filter(item => item.reasons.length > 0)
    .sort(
      (a, b) =>
        b.reasons.length - a.reasons.length || a.row.student.name.localeCompare(b.row.student.name),
    )

  return (
    <TemplateWidget
      widget={widget}
      isEditMode={isEditMode}
      dragHandleProps={dragHandleProps}
      isLoading={isLoading}
      error={error ? I18n.t("Your students didn't load.") : null}
      onRetry={() => refetch()}
      loadingText={I18n.t('Loading your students...')}
      actions={
        flagged.length > 0 ? (
          <View as="div" textAlign="center">
            <Link href="/self_paced/dashboard" isWithinText={false}>
              <Text size="small">
                {I18n.t('See all students (%{count} need attention)', {count: flagged.length})}
              </Text>
            </Link>
          </View>
        ) : undefined
      }
    >
      {flagged.length === 0 ? (
        <Text color="secondary" data-testid="students-need-you-empty">
          {I18n.t('Nobody is stuck, behind or inactive right now.')}
        </Text>
      ) : (
        <List isUnstyled margin="0" itemSpacing="small">
          {flagged.slice(0, SHOWN).map(({row, reasons}) => (
            <List.Item key={`${row.course.id}-${row.student.id}`}>
              <Link
                href={`/self_paced/dashboard?course_id=${row.course.id}&student_id=${row.student.id}`}
                isWithinText={false}
              >
                <Text weight="bold">{row.student.name}</Text>
              </Link>
              <Text size="small" color="secondary">
                {' '}
                {row.course.name}
              </Text>
              <View as="div" margin="xx-small 0 0">
                {reasons.map(reason => (
                  <View key={reason} as="span" margin="0 xx-small 0 0">
                    <Pill color={COLOR[reason]}>{LABEL[reason]()}</Pill>
                  </View>
                ))}
              </View>
            </List.Item>
          ))}
        </List>
      )}
    </TemplateWidget>
  )
}

export default StudentsNeedYouWidget
