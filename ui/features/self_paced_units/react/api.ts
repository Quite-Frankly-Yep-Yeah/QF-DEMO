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
import type {Item, NewItem, Setup} from './types'

const call = async <T>(path: string, method: string, body?: unknown): Promise<T | undefined> => {
  const {json} = await doFetchApi<T>({path, method, body: body as never})
  return json
}

export const loadSetup = async (setupUrl: string): Promise<Setup> =>
  (await call<Setup>(setupUrl, 'GET')) as Setup

// The player's module requirements come from the item roles, so they are
// rewritten after every change to the structure.
export const rewriteRequirements = async (setupUrl: string): Promise<void> => {
  await call(setupUrl, 'PUT', {items: []})
}

export const saveItem = async (setupUrl: string, item: Item): Promise<void> => {
  await call(setupUrl, 'PUT', {
    items: [
      {
        id: item.id,
        role: item.role,
        estimated_minutes: item.estimated_minutes,
        mastery_threshold: item.mastery_threshold,
        watch_fraction: item.watch_fraction,
        max_attempts: item.max_attempts,
        retake_review: item.retake_review,
        skill_id: item.skill_id,
      },
    ],
  })
}

const base = (courseId: string) => `/api/v1/courses/${courseId}`

export const addUnit = (courseId: string, name: string) =>
  call(`${base(courseId)}/modules`, 'POST', {module: {name}})

export const updateUnit = (
  courseId: string,
  unitId: string,
  fields: {name?: string; published?: boolean; position?: number},
) => call(`${base(courseId)}/modules/${unitId}`, 'PUT', {module: fields})

export const deleteUnit = (courseId: string, unitId: string) =>
  call(`${base(courseId)}/modules/${unitId}`, 'DELETE')

const itemPath = (courseId: string, unitId: string, itemId?: string) =>
  `${base(courseId)}/modules/${unitId}/items${itemId ? `/${itemId}` : ''}`

export const updateItem = (
  courseId: string,
  unitId: string,
  itemId: string,
  fields: {position?: number; published?: boolean},
) => call(itemPath(courseId, unitId, itemId), 'PUT', {module_item: fields})

export const deleteItem = (courseId: string, unitId: string, itemId: string) =>
  call(itemPath(courseId, unitId, itemId), 'DELETE')

export type Existing = {id: string; title: string}

// Pages use their url as the id.
export async function listExisting(
  courseId: string,
  kind: 'page' | 'quiz' | 'assignment',
): Promise<Existing[]> {
  const path = {page: 'pages', quiz: 'quizzes', assignment: 'assignments'}[kind]
  const rows =
    (await call<Array<Record<string, unknown>>>(`${base(courseId)}/${path}?per_page=100`, 'GET')) ??
    []
  return rows.map(row => ({
    id: String(kind === 'page' ? row.url : row.id),
    title: String(row.title ?? row.name),
  }))
}

// Makes what is needed, then adds it to the unit. Returns the new item's edit
// address when something new was created.
export async function addItem(
  courseId: string,
  unitId: string,
  item: NewItem,
): Promise<string | undefined> {
  let module_item: Record<string, unknown>
  let editUrl: string | undefined
  switch (item.kind) {
    case 'header':
      module_item = {type: 'SubHeader', title: item.title}
      break
    case 'new_page': {
      const page = await call<{url: string}>(`${base(courseId)}/pages`, 'POST', {
        wiki_page: {title: item.title, body: '', published: false},
      })
      module_item = {type: 'Page', page_url: page?.url, title: item.title}
      editUrl = `/courses/${courseId}/pages/${page?.url}/edit`
      break
    }
    case 'new_quiz': {
      const quiz = await call<{id: number}>(`${base(courseId)}/quizzes`, 'POST', {
        quiz: {title: item.title, published: false},
      })
      module_item = {type: 'Quiz', content_id: quiz?.id, title: item.title}
      editUrl = `/courses/${courseId}/quizzes/${quiz?.id}/edit`
      break
    }
    case 'new_assignment': {
      const assignment = await call<{id: number}>(`${base(courseId)}/assignments`, 'POST', {
        assignment: {
          name: item.title,
          submission_types: ['online_text_entry'],
          points_possible: 10,
          published: false,
        },
      })
      module_item = {type: 'Assignment', content_id: assignment?.id, title: item.title}
      editUrl = `/courses/${courseId}/assignments/${assignment?.id}/edit`
      break
    }
    case 'page':
      module_item = {type: 'Page', page_url: item.id, title: item.title}
      break
    case 'quiz':
      module_item = {type: 'Quiz', content_id: item.id, title: item.title}
      break
    case 'assignment':
      module_item = {type: 'Assignment', content_id: item.id, title: item.title}
      break
  }
  await call(itemPath(courseId, unitId), 'POST', {module_item})
  return editUrl
}
