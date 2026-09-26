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

import React, {useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {TemplateWidget} from '@instructure/platform-widget-dashboard'
import {Button, IconButton} from '@instructure/ui-buttons'
import {Flex} from '@instructure/ui-flex'
import {IconSpeedGraderLine, IconXLine} from '@instructure/ui-icons'
import {Link} from '@instructure/ui-link'
import {List} from '@instructure/ui-list'
import {Pill} from '@instructure/ui-pill'
import {SimpleSelect} from '@instructure/ui-simple-select'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import type {BaseWidgetProps} from '../../../types'
import {useWidgetConfig} from '../../../hooks/useWidgetConfig'
import {
  type EducatorTodo,
  todoId,
  todoTitle,
  useEducatorTodos,
} from '../../../hooks/useEducatorTodos'

const I18n = createI18nScope('widget_dashboard')

type Filter = 'all' | 'grading' | 'submitting'
const FILTERS: Filter[] = ['all', 'grading', 'submitting']
const SHOWN = 5

const isFilter = (value: unknown): value is Filter => FILTERS.includes(value as Filter)

// The teacher's real to-do list (quite frankly an example LMS's To Do: GET /api/v1/users/self/todo):
// assignments with work to grade, with how much is late, resubmitted or on
// time, and anything the teacher has to submit. Replaces the package's
// placeholder widget, which only showed sample items.
const EducatorTodoListWidget: React.FC<BaseWidgetProps> = ({
  widget,
  isEditMode = false,
  dragHandleProps,
}) => {
  const [filter, setFilter] = useWidgetConfig<Filter>(widget.id, 'filter', 'all', isFilter)
  const [showAll, setShowAll] = useState(false)
  const {data: todos = [], isLoading, error, refetch, dismiss} = useEducatorTodos()

  const filtered = todos.filter(todo => filter === 'all' || todo.type === filter)
  const shown = showAll ? filtered : filtered.slice(0, SHOWN)

  const renderContent = () => {
    if (filtered.length === 0) {
      return (
        <View as="div" margin="medium 0">
          <Text color="secondary" data-testid="educator-todo-empty">
            {filter === 'submitting'
              ? I18n.t('Nothing for you to submit.')
              : I18n.t('Nothing to grade. You are all caught up.')}
          </Text>
        </View>
      )
    }
    return (
      <List isUnstyled margin="0" itemSpacing="small">
        {shown.map(todo => (
          <List.Item key={todoId(todo)}>
            <TodoRow todo={todo} onDismiss={() => dismiss(todo)} />
          </List.Item>
        ))}
      </List>
    )
  }

  return (
    <TemplateWidget
      widget={widget}
      isEditMode={isEditMode}
      dragHandleProps={dragHandleProps}
      isLoading={isLoading}
      error={error ? I18n.t("Your to-do list didn't load.") : null}
      onRetry={() => refetch()}
      loadingText={I18n.t('Loading your to-do list...')}
      actions={
        filtered.length > SHOWN ? (
          <View as="div" textAlign="center">
            <Button
              withBackground={false}
              color="primary"
              onClick={() => setShowAll(!showAll)}
              data-testid="educator-todo-show-all"
            >
              {showAll
                ? I18n.t('Show fewer')
                : I18n.t('Show all %{count}', {count: filtered.length})}
            </Button>
          </View>
        ) : undefined
      }
    >
      <Flex direction="column" gap="small">
        <Flex.Item overflowX="visible" overflowY="visible">
          <SimpleSelect
            renderLabel={I18n.t('Show')}
            value={filter}
            onChange={(_event, {value}) => {
              setFilter(value as Filter)
              setShowAll(false)
            }}
            size="small"
            width="12rem"
            data-testid="educator-todo-filter"
          >
            <SimpleSelect.Option id="todo-all" value="all">
              {I18n.t('Everything')}
            </SimpleSelect.Option>
            <SimpleSelect.Option id="todo-grading" value="grading">
              {I18n.t('To grade')}
            </SimpleSelect.Option>
            <SimpleSelect.Option id="todo-submitting" value="submitting">
              {I18n.t('To submit')}
            </SimpleSelect.Option>
          </SimpleSelect>
        </Flex.Item>
        <Flex.Item shouldGrow overflowX="visible" overflowY="visible">
          {renderContent()}
        </Flex.Item>
      </Flex>
    </TemplateWidget>
  )
}

function dueText(todo: EducatorTodo): string | null {
  const due = todo.assignment?.due_at ?? todo.quiz?.due_at
  if (!due) return null
  return I18n.t('Due %{date}', {
    date: new Date(due).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
  })
}

function TodoRow({todo, onDismiss}: {todo: EducatorTodo; onDismiss: () => void}) {
  const title = todoTitle(todo)
  const grading = todo.type === 'grading'
  const late = todo.late_needs_grading_count ?? 0
  const resubmitted = todo.resubmitted_needs_grading_count ?? 0
  const onTime = todo.on_time_needs_grading_count ?? 0
  const hasBreakdown = late + resubmitted + onTime > 0
  const due = dueText(todo)

  return (
    <Flex gap="small" alignItems="start" data-testid={`educator-todo-${todoId(todo)}`}>
      <Flex.Item shouldGrow shouldShrink>
        <Flex direction="column" gap="xx-small">
          <Flex.Item overflowX="visible" overflowY="visible">
            <Link href={todo.html_url} isWithinText={false}>
              <Text weight="bold">{title}</Text>
            </Link>
          </Flex.Item>
          {todo.context_name && (
            <Flex.Item>
              <Text size="small" color="secondary">
                {todo.context_name}
              </Text>
            </Flex.Item>
          )}
          <Flex.Item overflowX="visible" overflowY="visible">
            <Flex gap="x-small" wrap="wrap" alignItems="center">
              {grading && hasBreakdown && late > 0 && (
                <Pill color="danger">{I18n.t('%{count} late', {count: late})}</Pill>
              )}
              {grading && hasBreakdown && resubmitted > 0 && (
                <Pill color="warning">{I18n.t('%{count} resubmitted', {count: resubmitted})}</Pill>
              )}
              {grading && hasBreakdown && onTime > 0 && (
                <Pill color="info">{I18n.t('%{count} on time', {count: onTime})}</Pill>
              )}
              {grading && !hasBreakdown && (todo.needs_grading_count ?? 0) > 0 && (
                <Pill color="info">
                  {I18n.t('%{count} to grade', {count: todo.needs_grading_count})}
                </Pill>
              )}
              {!grading && <Pill color="primary">{I18n.t('To submit')}</Pill>}
              {due && (
                <Text size="small" color="secondary">
                  {due}
                </Text>
              )}
            </Flex>
          </Flex.Item>
          {grading && (todo.total_submissions_count ?? 0) > 0 && (
            <Flex.Item>
              <Text size="small" color="secondary">
                {I18n.t('%{submitted} of %{total} students have submitted', {
                  submitted: todo.submitted_submissions_count ?? 0,
                  total: todo.total_submissions_count,
                })}
              </Text>
            </Flex.Item>
          )}
        </Flex>
      </Flex.Item>
      {grading && (
        <Flex.Item>
          <IconButton
            href={todo.html_url}
            screenReaderLabel={I18n.t('Grade %{title} in SpeedGrader', {title})}
            renderIcon={<IconSpeedGraderLine />}
            withBackground={false}
            withBorder={false}
          />
        </Flex.Item>
      )}
      <Flex.Item>
        <IconButton
          onClick={onDismiss}
          screenReaderLabel={I18n.t('Remove %{title} from your to-do list', {title})}
          renderIcon={<IconXLine />}
          withBackground={false}
          withBorder={false}
          size="small"
        />
      </Flex.Item>
    </Flex>
  )
}

export default EducatorTodoListWidget
