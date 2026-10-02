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

import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Spinner} from '@instructure/ui-spinner'
import {
  createCourse,
  enrollStudent,
  fetchCourses,
  fetchStudentCourseIds,
  fetchSubaccounts,
  fetchTerms,
  searchStudents,
  searchTeachers,
} from './api'
import {CATALOG_STYLES, Dialog, FlatButton, RaisedButton, Snackbar} from './bits'
import {activeFilterCount, DEFAULT_FILTERS, sortOptions} from './catalogModel'
import CourseCard from './CourseCard'
import FilterPanel from './FilterPanel'
import {ELEVATION, INK, ink, PALETTE, ROBOTO, SURFACE} from './material'
import StudentPicker from './StudentPicker'
import type {CatalogConfig, CatalogCourse, Filters, Option, Student} from './types'
import {useMaterialPage} from '@canvas/material/useMaterialPage'
import {useThemeTokens} from '@canvas/material/useThemeTokens'

const I18n = createI18nScope('course_catalog')

const LAYOUT_STYLES = `.cc-layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 24px; align-items: start; }
.cc-filters-toggle { display: none; }
@media (max-width: 860px) {
  .cc-layout { grid-template-columns: minmax(0, 1fr); }
  .cc-filters-toggle { display: inline-block; }
  .cc-filters[data-open="false"] { display: none; }
}`

const FIELD: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 0',
  marginBottom: 16,
  fontFamily: ROBOTO,
  fontSize: '1rem',
  background: 'transparent',
  border: 0,
  borderBottom: '1px solid rgba(0,0,0,0.42)',
  borderRadius: 0,
}

// The admin course catalog: search and filters on the left, a card per
// course on the right, and with a student chosen on the app bar, a way to
// enroll them in the course that suits them.
export default function CatalogApp({config}: {config: CatalogConfig}) {
  useMaterialPage()
  const appBar = ink(useThemeTokens().appBar)
  const accountId = config.account.id
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [searchInput, setSearchInput] = useState('')
  const [courses, setCourses] = useState<CatalogCourse[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [terms, setTerms] = useState<Option[]>([])
  const [subaccounts, setSubaccounts] = useState<Option[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<CatalogCourse | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [message, setMessage] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [saving, setSaving] = useState(false)

  const findStudents = useCallback(
    (term: string, signal: AbortSignal) => searchStudents(accountId, term, signal),
    [accountId],
  )
  const findTeachers = useCallback(
    (term: string, signal: AbortSignal) => searchTeachers(accountId, term, signal),
    [accountId],
  )

  useEffect(() => {
    fetchTerms(accountId)
      .then(setTerms)
      .catch(() => {})
    fetchSubaccounts(accountId)
      .then(setSubaccounts)
      .catch(() => {})
  }, [accountId])

  // the search box applies a moment after typing stops
  useEffect(() => {
    const timer = window.setTimeout(() => setFilters(f => ({...f, search: searchInput})), 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const filterKey = JSON.stringify(filters)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFailed(false)
    fetchCourses(accountId, filters, null, controller.signal)
      .then(page => {
        setCourses(page.courses)
        setNext(page.next)
        setLoading(false)
      })
      .catch(error => {
        if ((error as Error).name === 'AbortError') return
        setFailed(true)
        setLoading(false)
      })
    return () => controller.abort()
    // filterKey stands in for filters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, filterKey])

  useEffect(() => {
    setEnrolledIds(new Set())
    if (!student) return
    let current = true
    fetchStudentCourseIds(student.id)
      .then(ids => current && setEnrolledIds(ids))
      .catch(() => current && setMessage(I18n.t("Couldn't load this student's courses.")))
    return () => {
      current = false
    }
  }, [student])

  const change = (changes: Partial<Filters>) => setFilters(f => ({...f, ...changes}))
  const clearAll = () => {
    setSearchInput('')
    setFilters(f => ({...DEFAULT_FILTERS, sort: f.sort, order: f.order}))
  }

  const loadMore = () => {
    if (!next) return
    setLoadingMore(true)
    fetchCourses(accountId, filters, next)
      .then(page => {
        setCourses(current => [...current, ...page.courses])
        setNext(page.next)
      })
      .catch(() => setMessage(I18n.t("The next courses didn't load.")))
      .finally(() => setLoadingMore(false))
  }

  const confirmEnroll = () => {
    if (!pending || !student) return
    setEnrolling(true)
    enrollStudent(String(pending.id), student.id)
      .then(() => {
        setEnrolledIds(ids => new Set(ids).add(String(pending.id)))
        setMessage(
          I18n.t('%{student} is enrolled in %{course}.', {
            student: student.name,
            course: pending.name,
          }),
        )
      })
      .catch(() =>
        setMessage(
          I18n.t("Couldn't enroll %{student} in %{course}.", {
            student: student.name,
            course: pending.name,
          }),
        ),
      )
      .finally(() => {
        setEnrolling(false)
        setPending(null)
      })
  }

  const saveCourse = () => {
    setSaving(true)
    createCourse(accountId, newName.trim(), newCode.trim())
      .then(course => window.location.assign(`/courses/${course.id}`))
      .catch(() => {
        setMessage(I18n.t("The course wasn't created."))
        setSaving(false)
      })
  }

  const activeCount = activeFilterCount(filters)
  const summary = useMemo(() => {
    if (loading) return ''
    const count = courses.length
    return next
      ? I18n.t(
          {one: '1 course shown, more available', other: '%{count} courses shown, more available'},
          {count},
        )
      : I18n.t({one: '1 course', other: '%{count} courses'}, {count})
  }, [loading, courses.length, next])

  return (
    <div style={{fontFamily: ROBOTO, background: SURFACE, minHeight: '100%', paddingBottom: 48}}>
      <style>{CATALOG_STYLES + LAYOUT_STYLES}</style>
      <header
        style={{
          background: appBar,
          color: '#fff',
          boxShadow: ELEVATION[4],
          borderRadius: '2px 2px 0 0',
        }}
      >
        <div aria-hidden="true" style={{display: 'flex', height: 6}}>
          {PALETTE.map(color => (
            <span key={color} style={{flex: 1, background: color}} />
          ))}
        </div>
        <div style={{padding: '32px 32px 32px'}}>
          <div style={{opacity: 0.88}}>{config.account.name}</div>
          <div style={{display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap'}}>
            <h1
              style={{
                margin: '4px 0 24px',
                flex: 1,
                fontFamily: ROBOTO,
                fontWeight: 300,
                fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.5px',
                color: '#fff',
              }}
            >
              {I18n.t('Course catalog')}
            </h1>
            {config.can_create && (
              <RaisedButton
                color="#eb6834"
                style={{marginBottom: 24}}
                onClick={() => setCreating(true)}
              >
                {I18n.t('New course')}
              </RaisedButton>
            )}
          </div>
          <StudentPicker student={student} onChange={setStudent} search={findStudents} />
        </div>
      </header>

      <div style={{padding: '24px 32px 0'}}>
        <div className="cc-layout">
          <aside className="cc-filters" data-open={filtersOpen ? 'true' : 'false'}>
            <FilterPanel
              filters={filters}
              terms={terms}
              subaccounts={subaccounts}
              activeCount={activeCount}
              onChange={change}
              onClear={clearAll}
              searchTeachers={findTeachers}
            />
          </aside>

          <main>
            <div
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                marginBottom: 8,
              }}
            >
              <label style={{flex: '1 1 260px'}}>
                <span style={{display: 'block', fontSize: '0.75rem', color: INK.secondary}}>
                  {I18n.t('Search by course name, code or ID')}
                </span>
                <input
                  type="search"
                  className="cc-input"
                  value={searchInput}
                  onChange={event => setSearchInput(event.target.value)}
                  style={{...FIELD, marginBottom: 0}}
                />
              </label>
              <label>
                <span style={{display: 'block', fontSize: '0.75rem', color: INK.secondary}}>
                  {I18n.t('Sort by')}
                </span>
                <select
                  className="cc-input"
                  value={filters.sort}
                  onChange={event => change({sort: event.target.value as Filters['sort']})}
                  style={{...FIELD, marginBottom: 0, width: 'auto'}}
                >
                  {sortOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <FlatButton
                aria-label={
                  filters.order === 'asc' ? I18n.t('Sorted ascending') : I18n.t('Sorted descending')
                }
                onClick={() => change({order: filters.order === 'asc' ? 'desc' : 'asc'})}
              >
                {filters.order === 'asc' ? '↑ A–Z' : '↓ Z–A'}
              </FlatButton>
              <FlatButton
                className="cc-filters-toggle"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(open => !open)}
              >
                {I18n.t('Filters (%{count})', {count: activeCount})}
              </FlatButton>
            </div>
            <div aria-live="polite" style={{minHeight: 24, color: INK.secondary, marginBottom: 8}}>
              {summary}
            </div>

            {loading && (
              <div style={{textAlign: 'center', padding: 64}}>
                <Spinner renderTitle={I18n.t('Loading courses')} />
              </div>
            )}
            {failed && !loading && (
              <p style={{color: INK.primary}}>
                {I18n.t("The catalog didn't load.")}{' '}
                <FlatButton onClick={() => setFilters(f => ({...f}))}>
                  {I18n.t('Try again')}
                </FlatButton>
              </p>
            )}
            {!loading && !failed && courses.length === 0 && (
              <p style={{color: INK.secondary, padding: '32px 0'}}>
                {I18n.t('No courses match these filters.')}
              </p>
            )}
            {!loading && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 24,
                  alignItems: 'stretch',
                }}
              >
                {courses.map(course => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    student={student}
                    enrolled={enrolledIds.has(String(course.id))}
                    onEnroll={setPending}
                  />
                ))}
              </div>
            )}
            {!loading && next && (
              <div style={{textAlign: 'center', marginTop: 24}}>
                <RaisedButton disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? I18n.t('Loading…') : I18n.t('Show more courses')}
                </RaisedButton>
              </div>
            )}
          </main>
        </div>
      </div>

      {pending && student && (
        <Dialog
          title={I18n.t('Enroll %{student}?', {student: student.name})}
          onClose={() => setPending(null)}
          actions={
            <>
              <FlatButton onClick={() => setPending(null)}>{I18n.t('Cancel')}</FlatButton>
              <RaisedButton disabled={enrolling} onClick={confirmEnroll}>
                {I18n.t('Enroll')}
              </RaisedButton>
            </>
          }
        >
          <p style={{margin: 0}}>
            {I18n.t(
              '%{student} will be added to %{course} as a student, and can open it right away.',
              {
                student: student.name,
                course: pending.name,
              },
            )}
          </p>
        </Dialog>
      )}

      {creating && (
        <Dialog
          title={I18n.t('New course')}
          onClose={() => setCreating(false)}
          actions={
            <>
              <FlatButton onClick={() => setCreating(false)}>{I18n.t('Cancel')}</FlatButton>
              <RaisedButton disabled={saving || newName.trim() === ''} onClick={saveCourse}>
                {I18n.t('Create')}
              </RaisedButton>
            </>
          }
        >
          <label>
            <span style={{fontSize: '0.75rem', color: INK.secondary}}>{I18n.t('Course name')}</span>
            <input
              className="cc-input"
              value={newName}
              onChange={event => setNewName(event.target.value)}
              style={FIELD}
            />
          </label>
          <label>
            <span style={{fontSize: '0.75rem', color: INK.secondary}}>{I18n.t('Course code')}</span>
            <input
              className="cc-input"
              value={newCode}
              onChange={event => setNewCode(event.target.value)}
              style={{...FIELD, marginBottom: 0}}
            />
          </label>
        </Dialog>
      )}

      {message && <Snackbar message={message} onDismiss={() => setMessage('')} />}
    </div>
  )
}
