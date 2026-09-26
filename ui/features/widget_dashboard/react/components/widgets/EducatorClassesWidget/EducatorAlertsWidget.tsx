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
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {TemplateWidget} from '@instructure/platform-widget-dashboard'
import {Button} from '@instructure/ui-buttons'
import {Link} from '@instructure/ui-link'
import {List} from '@instructure/ui-list'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import type {BaseWidgetProps} from '../../../types'

const I18n = createI18nScope('widget_dashboard')
const SHOWN = 6

type AlertJson = {
  id: string
  kind: string
  description: string
  student: {id: string; name: string}
  course: {id: string; name: string}
}

// Open alerts (Phase 6) for the viewer's students: what is wrong, a link to
// the student's panel, and a way to dismiss.
const EducatorAlertsWidget: React.FC<BaseWidgetProps> = ({
  widget,
  isEditMode = false,
  dragHandleProps,
}) => {
  const queryClient = useQueryClient()
  const {
    data: alerts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['educatorAlerts'],
    queryFn: async () => {
      const {json} = await doFetchApi<{alerts: AlertJson[]}>({path: '/api/v1/self_paced/alerts'})
      return json?.alerts ?? []
    },
    refetchInterval: 60_000,
  })
  const dismiss = useMutation({
    mutationFn: (id: string) =>
      doFetchApi({path: `/api/v1/self_paced/alerts/${id}/dismiss`, method: 'PUT'}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['educatorAlerts']}),
  })

  return (
    <TemplateWidget
      widget={widget}
      isEditMode={isEditMode}
      dragHandleProps={dragHandleProps}
      isLoading={isLoading}
      error={error ? I18n.t("Your alerts didn't load.") : null}
      onRetry={() => refetch()}
      loadingText={I18n.t('Loading your alerts...')}
    >
      {alerts.length === 0 ? (
        <Text color="secondary" data-testid="educator-alerts-empty">
          {I18n.t('No open alerts.')}
        </Text>
      ) : (
        <List isUnstyled margin="0" itemSpacing="small">
          {alerts.slice(0, SHOWN).map(alert => (
            <List.Item key={alert.id}>
              <Link
                href={`/self_paced/dashboard?course_id=${alert.course.id}&student_id=${alert.student.id}`}
                isWithinText={false}
              >
                <Text weight="bold">{alert.student.name}</Text>
              </Link>
              <Text size="small" color="secondary">
                {' '}
                {alert.course.name}
              </Text>
              <View as="div">
                <Text size="small">{alert.description}</Text>{' '}
                <Button
                  size="small"
                  withBackground={false}
                  color="secondary"
                  onClick={() => dismiss.mutate(alert.id)}
                  aria-label={I18n.t('Dismiss the alert for %{student}', {
                    student: alert.student.name,
                  })}
                >
                  {I18n.t('Dismiss')}
                </Button>
              </View>
            </List.Item>
          ))}
          {alerts.length > SHOWN && (
            <List.Item>
              <Text size="small" color="secondary">
                {I18n.t('and %{count} more', {count: alerts.length - SHOWN})}
              </Text>
            </List.Item>
          )}
        </List>
      )}
    </TemplateWidget>
  )
}

export default EducatorAlertsWidget
