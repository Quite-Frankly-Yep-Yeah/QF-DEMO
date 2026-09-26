/*
 * Copyright (C) 2025 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import type {WidgetRegistry, WidgetRenderer} from '../types'
import {WIDGET_TYPES, EDUCATOR_WIDGET_ROLE} from '../constants'
import CourseWorkCombinedWidget from './widgets/CourseWorkCombinedWidget/CourseWorkCombinedWidget'
import CourseGradesWidget from './widgets/CourseGradesWidget/CourseGradesWidget'
import AnnouncementsWidget from './widgets/AnnouncementsWidget/AnnouncementsWidget'
import PeopleWidget from './widgets/PeopleWidget/PeopleWidget'
import TodoListWidget from './widgets/TodoListWidget/TodoListWidget'
import RecentGradesWidget from './widgets/RecentGradesWidget/RecentGradesWidget'
import {
  ProgressOverviewWidget,
  EducatorAnnouncementCreationWidget,
  EducatorContentQualityWidget,
} from '@instructure/platform-widget-dashboard'
// ours: the package's educator to-do widget only shows sample items
import EducatorTodoListWidget from './widgets/EducatorTodoListWidget/EducatorTodoListWidget'
import {renderAnnouncementMessageEditor} from './widgets/EducatorAnnouncementCreationWidget/AnnouncementMessageEditor'
import InboxWidget from './widgets/InboxWidget/InboxWidget'
import StudentsNeedYouWidget from './widgets/EducatorClassesWidget/StudentsNeedYouWidget'
import ClassProgressWidget from './widgets/EducatorClassesWidget/ClassProgressWidget'
import EducatorAlertsWidget from './widgets/EducatorClassesWidget/EducatorAlertsWidget'

const widgetRegistry: WidgetRegistry = {
  [WIDGET_TYPES.COURSE_WORK_COMBINED]: {
    component: CourseWorkCombinedWidget,
    displayName: 'Course work',
    description: 'View course work statistics and assignments in one comprehensive view',
  },
  [WIDGET_TYPES.COURSE_GRADES]: {
    component: CourseGradesWidget,
    displayName: 'Course grades',
    description: 'Track your grades and academic progress across all courses',
  },
  [WIDGET_TYPES.ANNOUNCEMENTS]: {
    component: AnnouncementsWidget,
    displayName: 'Announcements',
    description: 'Stay updated with the latest announcements from your courses',
  },
  [WIDGET_TYPES.PEOPLE]: {
    component: PeopleWidget,
    displayName: 'People',
    description: 'View and contact your course instructors and teaching assistants',
  },
  [WIDGET_TYPES.TODO_LIST]: {
    component: TodoListWidget,
    displayName: 'To-do list',
    description: 'View and manage your planner items and upcoming tasks',
  },
  [WIDGET_TYPES.RECENT_GRADES]: {
    component: RecentGradesWidget,
    displayName: 'Recent grades & feedback',
    description: 'View your recently graded assignments and submissions',
  },
  [WIDGET_TYPES.PROGRESS_OVERVIEW]: {
    component: ProgressOverviewWidget,
    displayName: 'Progress overview',
    description: 'Track your progress across courses with module and assignment statistics',
  },
  [WIDGET_TYPES.INBOX]: {
    component: InboxWidget,
    displayName: 'Inbox',
    description: 'View recent messages from your quite frankly an example LMS conversations',
  },
  [WIDGET_TYPES.EDUCATOR_ANNOUNCEMENT_CREATION]: {
    component: EducatorAnnouncementCreationWidget,
    displayName: 'Announcement creation',
    description: 'Create and post announcements to your courses',
    roles: [EDUCATOR_WIDGET_ROLE],
    props: {
      renderMessageEditor: renderAnnouncementMessageEditor,
    },
  },
  [WIDGET_TYPES.EDUCATOR_TODO_LIST]: {
    component: EducatorTodoListWidget,
    displayName: 'To-do list',
    description: 'Work to grade in your courses, and anything you need to submit',
    roles: [EDUCATOR_WIDGET_ROLE],
  },
  [WIDGET_TYPES.EDUCATOR_CONTENT_QUALITY]: {
    component: EducatorContentQualityWidget,
    displayName: 'Content Quality',
    description: 'Content quality and accessibility educator widget',
    roles: [EDUCATOR_WIDGET_ROLE],
  },
  [WIDGET_TYPES.EDUCATOR_STUDENTS_NEED_YOU]: {
    component: StudentsNeedYouWidget,
    displayName: 'Students who need you',
    description: 'Students who are stuck, behind pace or inactive',
    roles: [EDUCATOR_WIDGET_ROLE],
  },
  [WIDGET_TYPES.EDUCATOR_CLASS_PROGRESS]: {
    component: ClassProgressWidget,
    displayName: 'Class progress',
    description: 'Average progress in each of your self-paced classes',
    roles: [EDUCATOR_WIDGET_ROLE],
  },
  [WIDGET_TYPES.EDUCATOR_ALERTS]: {
    component: EducatorAlertsWidget,
    displayName: 'Alerts',
    description: 'Students your alert rules have flagged, with a way to dismiss each',
    roles: [EDUCATOR_WIDGET_ROLE],
  },
}

export const registerWidget = (type: string, renderer: WidgetRenderer): void => {
  widgetRegistry[type] = renderer
}

export const getWidget = (type: string): WidgetRenderer | undefined => {
  return widgetRegistry[type]
}

// Returns all registered widgets regardless of role, including educator-only widgets.
// Prefer getWidgetsForRole() when rendering widgets for a specific user.
export const getAllWidgets = (): WidgetRegistry => {
  return {...widgetRegistry}
}

// Widgets without a roles field are treated as learner widgets
const isLearnerWidget = (renderer: WidgetRenderer) => !renderer.roles?.length
const matchesRole = (renderer: WidgetRenderer, role?: string) =>
  role ? renderer.roles?.includes(role) : isLearnerWidget(renderer)

export const getWidgetsForRole = (role?: string): WidgetRegistry =>
  Object.fromEntries(
    Object.entries(widgetRegistry).filter(([_key, renderer]) => matchesRole(renderer, role)),
  )

export const isRegisteredWidget = (type: string): boolean => {
  return type in widgetRegistry
}

export default widgetRegistry
