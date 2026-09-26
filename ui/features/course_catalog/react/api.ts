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

import doFetchApi from '@canvas/do-fetch-api-effect'
import {buildCourseParams} from './catalogModel'
import type {CatalogCourse, Filters, Option, Student, Teacher} from './types'

export type CoursePage = {courses: CatalogCourse[]; next: string | null}

type ApiUser = {id: number | string; name: string; sortable_name?: string}

// One page of the catalog. Pass +nextUrl+ (from the previous page) to get the
// page after it.
export async function fetchCourses(
  accountId: string,
  filters: Filters,
  nextUrl?: string | null,
  signal?: AbortSignal,
): Promise<CoursePage> {
  const {json, link} = nextUrl
    ? await doFetchApi<CatalogCourse[]>({path: nextUrl, signal})
    : await doFetchApi<CatalogCourse[]>({
        path: `/api/v1/accounts/${accountId}/courses`,
        params: buildCourseParams(filters),
        signal,
      })
  return {courses: json ?? [], next: link?.next?.url ?? null}
}

export async function fetchTerms(accountId: string): Promise<Option[]> {
  const {json} = await doFetchApi<{enrollment_terms: {id: number | string; name: string}[]}>({
    path: `/api/v1/accounts/${accountId}/terms`,
    params: {per_page: 100},
  })
  return (json?.enrollment_terms ?? []).map(t => ({id: String(t.id), name: t.name}))
}

export async function fetchSubaccounts(accountId: string): Promise<Option[]> {
  const {json} = await doFetchApi<{id: number | string; name: string}[]>({
    path: `/api/v1/accounts/${accountId}/sub_accounts`,
    params: {recursive: 'true', per_page: 100},
  })
  return (json ?? []).map(a => ({id: String(a.id), name: a.name}))
}

async function searchUsers(
  accountId: string,
  enrollmentType: 'student' | 'teacher',
  term: string,
  signal?: AbortSignal,
): Promise<ApiUser[]> {
  const {json} = await doFetchApi<ApiUser[]>({
    path: `/api/v1/accounts/${accountId}/users`,
    params: {search_term: term, enrollment_type: enrollmentType, per_page: 8},
    signal,
  })
  return json ?? []
}

export async function searchStudents(
  accountId: string,
  term: string,
  signal?: AbortSignal,
): Promise<Student[]> {
  const users = await searchUsers(accountId, 'student', term, signal)
  return users.map(u => ({id: String(u.id), name: u.name, sortable_name: u.sortable_name}))
}

export async function searchTeachers(
  accountId: string,
  term: string,
  signal?: AbortSignal,
): Promise<Teacher[]> {
  const users = await searchUsers(accountId, 'teacher', term, signal)
  return users.map(u => ({id: String(u.id), name: u.name}))
}

// The ids of the courses a student is already in, so the catalog can mark
// them. Reads every page.
export async function fetchStudentCourseIds(studentId: string): Promise<Set<string>> {
  const ids = new Set<string>()
  let path: string | null = `/api/v1/users/${studentId}/courses?per_page=100`
  while (path) {
    const {json, link}: {json?: {id: number | string}[]; link?: {next?: {url: string}}} =
      await doFetchApi<{id: number | string}[]>({path})
    ;(json ?? []).forEach(course => ids.add(String(course.id)))
    path = link?.next?.url ?? null
  }
  return ids
}

export async function enrollStudent(courseId: string, studentId: string): Promise<void> {
  await doFetchApi({
    path: `/api/v1/courses/${courseId}/enrollments`,
    method: 'POST',
    body: {enrollment: {user_id: studentId, type: 'StudentEnrollment', enrollment_state: 'active'}},
  })
}

export async function createCourse(
  accountId: string,
  name: string,
  code: string,
): Promise<{id: number | string}> {
  const {json} = await doFetchApi<{id: number | string}>({
    path: `/api/v1/accounts/${accountId}/courses`,
    method: 'POST',
    body: {course: {name, course_code: code || undefined}},
  })
  return json as {id: number | string}
}
