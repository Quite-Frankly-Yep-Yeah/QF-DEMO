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

import React, {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {IconButton} from '@instructure/ui-buttons'
import {Checkbox} from '@instructure/ui-checkbox'
import {IconRefreshLine, IconSearchLine, IconXLine} from '@instructure/ui-icons'
import {SimpleSelect} from '@instructure/ui-simple-select'
import {TextInput} from '@instructure/ui-text-input'
import {ScreenReaderContent} from './bits'
import {INK} from './colors'
import {QUICK_FILTERS, quickFilterLabel, type QuickFilter} from './filters'
import {appBarBackground, AppBarTabs, DIVIDER, ELEVATION, PAPER, ROBOTO} from './material'
import type {CourseRef} from './types'

const I18n = createI18nScope('self_paced_dashboard')

export const ALL_COURSES = 'all'

type Props = {
  color: string
  stripe: string[] // course colors along the bottom of the bar, when showing every course
  tab: 'roster' | 'live'
  onTab: (tab: 'roster' | 'live') => void
  search: string
  onSearch: (value: string) => void
  courses: CourseRef[]
  course: string
  onCourse: (courseId: string) => void
  caseloadOnly: boolean
  onCaseloadOnly: (value: boolean) => void
  quick: QuickFilter
  onQuick: (filter: QuickFilter) => void
  counts: Record<QuickFilter, number>
  updatedAt: Date
  refreshFailed: boolean
  onRefresh: () => void
  onHeight: (pixels: number) => void // where the sticky table headers go
  singleCourse?: boolean // the course page: no course picker
}

// The bar that stays at the top while the roster scrolls: views and search on
// the course color, and the filters on white underneath.
export default function Toolbar(props: Props) {
  const bar = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement | null>(null)
  const top = useTopOffset(bar)
  const {onHeight} = props

  // Tell the page where the bar ends, so sticky table headers sit under it.
  useLayoutEffect(() => {
    const node = bar.current
    if (!node) return
    const report = () => onHeight(top + node.offsetHeight)
    report()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(report)
    observer.observe(node)
    return () => observer.disconnect()
  }, [top, onHeight])

  // "/" jumps to the search box from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      searchInput.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      ref={bar}
      data-testid="self-paced-toolbar"
      style={{
        position: 'sticky',
        top,
        zIndex: 10,
        margin: '0 0 24px',
        boxShadow: ELEVATION[4],
        borderRadius: '0 0 2px 2px',
        fontFamily: ROBOTO,
      }}
    >
      <div
        style={{
          background: appBarBackground(props.color),
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px 16px',
          padding: '0 16px',
        }}
      >
        <AppBarTabs
          label={I18n.t('Views')}
          selected={props.tab}
          onSelect={id => props.onTab(id as 'roster' | 'live')}
          tabs={[
            {id: 'roster', label: I18n.t('Roster')},
            {id: 'live', label: I18n.t('Live')},
          ]}
        />
        <div style={{flex: '1 1 16rem', maxWidth: '28rem', marginLeft: 'auto', padding: '8px 0'}}>
          <TextInput
            type="search"
            inputRef={node => {
              searchInput.current = node
            }}
            renderLabel={<ScreenReaderContent>{I18n.t('Search students')}</ScreenReaderContent>}
            placeholder={I18n.t('Search students (press /)')}
            value={props.search}
            onChange={(_event, value) => props.onSearch(value)}
            onKeyDown={event => {
              if (event.key === 'Escape') props.onSearch('')
            }}
            renderBeforeInput={<IconSearchLine inline={false} />}
            renderAfterInput={
              props.search ? (
                <IconButton
                  size="small"
                  withBackground={false}
                  withBorder={false}
                  renderIcon={<IconXLine />}
                  screenReaderLabel={I18n.t('Clear search')}
                  onClick={() => {
                    props.onSearch('')
                    searchInput.current?.focus()
                  }}
                />
              ) : undefined
            }
          />
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 4, color: '#fff'}}>
          <UpdatedAgo at={props.updatedAt} failed={props.refreshFailed} />
          <IconButton
            size="small"
            color="primary-inverse"
            withBackground={false}
            withBorder={false}
            renderIcon={<IconRefreshLine />}
            screenReaderLabel={I18n.t('Refresh now')}
            onClick={props.onRefresh}
          />
        </div>
      </div>
      {props.stripe.length > 1 && (
        <div aria-hidden="true" style={{display: 'flex', height: 4}}>
          {props.stripe.map((stripeColor, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: colors can repeat past eight courses
            <span key={index} style={{flex: 1, background: stripeColor}} />
          ))}
        </div>
      )}

      <div
        style={{
          background: PAPER,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px 16px',
          padding: '10px 16px',
          borderRadius: '0 0 2px 2px',
        }}
      >
        {!props.singleCourse && (
          <div style={{width: '15rem'}}>
            <SimpleSelect
              renderLabel={<ScreenReaderContent>{I18n.t('Course')}</ScreenReaderContent>}
              size="small"
              value={props.course}
              onChange={(_event, {value}) => props.onCourse(String(value))}
            >
              <SimpleSelect.Option id="course-all" value={ALL_COURSES}>
                {I18n.t('All my courses')}
              </SimpleSelect.Option>
              {props.courses.map(course => (
                <SimpleSelect.Option key={course.id} id={`course-${course.id}`} value={course.id}>
                  {course.name}
                </SimpleSelect.Option>
              ))}
            </SimpleSelect>
          </div>
        )}
        <Checkbox
          variant="toggle"
          size="small"
          label={I18n.t('Only my caseload')}
          checked={props.caseloadOnly}
          onChange={() => props.onCaseloadOnly(!props.caseloadOnly)}
        />
        <div
          role="group"
          aria-label={I18n.t('Show')}
          style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 'auto'}}
        >
          {QUICK_FILTERS.map(filter => (
            <FilterChip
              key={filter}
              label={quickFilterLabel(filter)}
              count={props.counts[filter]}
              selected={props.quick === filter}
              color={props.color}
              onClick={() => props.onQuick(filter)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// A Material filter chip: grey, or filled with a check when chosen.
function FilterChip({
  label,
  count,
  selected,
  color,
  onClick,
}: {
  label: string
  count: number
  selected: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className="self-paced-chip"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 32,
        padding: '0 12px',
        borderRadius: 16,
        border: 0,
        background: selected ? appBarBackground(color) : DIVIDER,
        color: selected ? '#fff' : INK.primary,
        fontFamily: ROBOTO,
        fontSize: '0.8125rem',
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {selected && <span aria-hidden="true">✓</span>}
      {label}
      <span style={{fontVariantNumeric: 'tabular-nums', opacity: 0.85, fontWeight: 400}}>
        {count}
      </span>
    </button>
  )
}

// "Updated 2 min ago", kept fresh without a new request.
function UpdatedAgo({at, failed}: {at: Date; failed: boolean}) {
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick(n => n + 1), 15_000)
    return () => clearInterval(timer)
  }, [])
  const minutes = Math.floor((Date.now() - at.getTime()) / 60_000)
  const text =
    minutes < 1
      ? I18n.t('Updated just now')
      : I18n.t({one: 'Updated 1 min ago', other: 'Updated %{count} min ago'}, {count: minutes})
  return (
    <span style={{fontSize: '0.8125rem', opacity: 0.9, whiteSpace: 'nowrap'}} aria-live="polite">
      {failed ? I18n.t("Couldn't refresh. %{updated}", {updated: text}) : text}
    </span>
  )
}

// The height of anything the page pins to the top of the window (quite frankly an example LMS's top
// bar in some themes), so our bar sticks just below it instead of under it.
function useTopOffset(own: React.RefObject<HTMLElement | null>): number {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const measure = () => {
      if (typeof document.elementsFromPoint !== 'function') return
      let bottom = 0
      for (const element of document.elementsFromPoint(window.innerWidth / 2, 1)) {
        if (own.current?.contains(element)) continue
        let node: Element | null = element
        while (node && node !== document.body) {
          const position = getComputedStyle(node).position
          if (position === 'fixed' || position === 'sticky') {
            const rect = node.getBoundingClientRect()
            if (rect.top <= 1) bottom = Math.max(bottom, rect.bottom)
            break
          }
          node = node.parentElement
        }
      }
      setOffset(Math.round(bottom))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [own])
  return offset
}
