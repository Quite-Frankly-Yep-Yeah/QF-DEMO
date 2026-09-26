/*
 * Copyright (C) 2015 - present Instructure, Inc.
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

import {useScope as createI18nScope} from '@canvas/i18n'
import React, {type MouseEventHandler, useCallback, useEffect, useState} from 'react'

import {assignLocation} from '@canvas/util/globalUtils'
import type {ConnectDragSource, ConnectDropTarget} from 'react-dnd'
import instFSOptimizedImageUrl from '../util/instFSOptimizedImageUrl'
import CourseActivitySummaryStore from './CourseActivitySummaryStore'
import DashboardCardAction from './DashboardCardAction'
import PublishButton from './PublishButton'

const I18n = createI18nScope('dashcards')

export type DashboardCardHeaderHeroProps = {
  image?: string
  backgroundColor?: string
  hideColorOverlays?: boolean
  onClick?: MouseEventHandler<HTMLElement>
}

export const DashboardCardHeaderHero = ({
  image,
  backgroundColor,
  hideColorOverlays,
  onClick,
}: DashboardCardHeaderHeroProps) => {
  if (image) {
    return (
      <div
        className="ic-DashboardCard__header_image"
        style={{backgroundImage: `url(${instFSOptimizedImageUrl(image, {x: 262, y: 146})})`}}
      >
        <div
          className="ic-DashboardCard__header_hero"
          style={{backgroundColor, opacity: hideColorOverlays ? 0 : 0.6}}
          onClick={onClick}
          aria-hidden="true"
        />
      </div>
    )
  }

  return (
    <div
      className="ic-DashboardCard__header_hero"
      style={{backgroundColor}}
      onClick={onClick}
      aria-hidden="true"
    />
  )
}

export type DashboardCardProps = {
  id: string
  backgroundColor?: string
  shortName: string
  originalName: string
  courseCode: string
  assetString: string
  term?: string
  href: string
  links: any[] // TODO: improve type
  image?: string
  hideColorOverlays?: boolean
  isDragging?: boolean
  connectDragSource?: ConnectDragSource
  connectDropTarget?: ConnectDropTarget
  enrollmentType?: string
  observee?: string
  published?: boolean
  canChangeCoursePublishState?: boolean
  defaultView?: string
  pagesUrl?: string
  frontPageTitle?: string
  onPublishedCourse?: (id: string) => void
  headingLevel?: string
}

export const DashboardCard = ({
  id,
  backgroundColor = '#334451',
  shortName,
  originalName,
  courseCode,
  assetString,
  term,
  href,
  links = [],
  image,
  hideColorOverlays,
  isDragging,
  connectDragSource = (c: any) => c,
  connectDropTarget = (c: any) => c,
  enrollmentType,
  observee,
  published,
  canChangeCoursePublishState,
  defaultView,
  pagesUrl,
  frontPageTitle,
  onPublishedCourse = () => {},
  headingLevel = 'h3',
}: DashboardCardProps) => {
  // @ts-expect-error
  const [course, setCourse] = useState(CourseActivitySummaryStore.getStateForCourse(id))

  const handleStoreChange = useCallback(
    // @ts-expect-error
    () => setCourse(CourseActivitySummaryStore.getStateForCourse(id)),
    [id],
  )

  useEffect(() => {
    CourseActivitySummaryStore.addChangeListener(handleStoreChange)
    return () => CourseActivitySummaryStore.removeChangeListener(handleStoreChange)
  }, [handleStoreChange])

  // ===============
  //    ACTIONS
  // ===============

  const headerClick: MouseEventHandler = e => {
    e.preventDefault()
    assignLocation(href)
  }

  // ===============
  //    HELPERS
  // ===============

  const unreadCount = (icon: string, stream?: any[]) => {
    const activityType = {
      'icon-announcement': 'Announcement',
      'icon-assignment': 'Message',
      'icon-discussion': 'DiscussionTopic',
    }[icon]

    const itemStream = stream || []
    const streamItem = itemStream.find(
      item =>
        // only return 'Message' type if category is 'Due Date' (for assignments)
        item.type === activityType &&
        (activityType !== 'Message' || item.notification_category === I18n.t('Due Date')),
    )

    // TODO: unread count is always 0 for assignments (see CNVS-21227)
    return streamItem ? streamItem.unread_count : 0
  }

  const updatePublishedCourse = () => {
    if (onPublishedCourse) onPublishedCourse(id)
  }

  // ===============
  //    RENDERING
  // ===============

  const linksForCard = () =>
    links.map(link => {
      if (link.hidden) return null

      const screenReaderLabel = `${link.label} - ${shortName}`
      return (
        <DashboardCardAction
          // @ts-expect-error InstUI component prop type mismatch
          unreadCount={unreadCount(link.icon, course?.stream)}
          iconClass={link.icon}
          linkClass={link.css_class}
          path={link.path}
          screenReaderLabel={screenReaderLabel}
          key={link.path}
        />
      )
    })

  const CardHeading = headingLevel as keyof JSX.IntrinsicElements

  const dashboardCard = (
    <div
      className="ic-DashboardCard"
      style={{opacity: isDragging ? 0 : 1}}
      aria-label={originalName}
      data-testid="draggable-card"
    >
      <div className="ic-DashboardCard__header">
        <span className="screenreader-only">
          {image
            ? I18n.t('Course image for %{course}', {course: shortName})
            : I18n.t('Course card color region for %{course}', {
                course: shortName,
              })}
        </span>
        <DashboardCardHeaderHero
          image={image}
          backgroundColor={backgroundColor}
          hideColorOverlays={hideColorOverlays}
          onClick={headerClick}
        />
        <a href={href} className="ic-DashboardCard__link">
          <div className="ic-DashboardCard__header_content">
            <CardHeading
              className="ic-DashboardCard__header-title ellipsis"
              title={originalName}
              data-testid="dashboard-card-title"
            >
              <span style={{color: backgroundColor}}>{shortName}</span>
            </CardHeading>
            <div className="ic-DashboardCard__header-subtitle ellipsis" title={courseCode}>
              {courseCode}
            </div>
            <div className="ic-DashboardCard__header-term ellipsis" title={term}>
              {term || null}
            </div>
            {enrollmentType === 'ObserverEnrollment' && observee && (
              <div className="ic-DashboardCard__header-term ellipsis" title={observee}>
                {I18n.t('Observing: %{observee}', {observee})}
              </div>
            )}
          </div>
        </a>
        {!published && canChangeCoursePublishState && (
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore InstUI component type issue
          <PublishButton
            courseNickname={shortName}
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore InstUI component prop type mismatch
            defaultView={defaultView}
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore InstUI component prop type mismatch
            pagesUrl={pagesUrl}
            frontPageTitle={frontPageTitle}
            courseId={id}
            onSuccess={updatePublishedCourse}
          />
        )}
      </div>
      <nav
        className="ic-DashboardCard__action-container"
        aria-label={I18n.t('Actions for %{course}', {course: shortName})}
      >
        {linksForCard()}
      </nav>
    </div>
  )

  return connectDragSource(connectDropTarget(dashboardCard))
}

export default DashboardCard
