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

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import doFetchApi from '@canvas/do-fetch-api-effect'

export const EDUCATOR_TODOS_KEY = 'educatorTodos'

// One item of GET /api/v1/users/self/todo, the same list as Canvas's To Do
// sidebar: work to grade in the viewer's courses, and anything they have to
// submit themselves.
export type EducatorTodo = {
  type: 'grading' | 'submitting'
  html_url: string
  ignore: string
  context_name?: string
  course_id?: number
  assignment?: {id: number | string; name: string; due_at?: string | null}
  quiz?: {id: number | string; title: string; due_at?: string | null}
  needs_grading_count?: number
  on_time_needs_grading_count?: number
  late_needs_grading_count?: number
  resubmitted_needs_grading_count?: number
  submitted_submissions_count?: number
  total_submissions_count?: number
}

export function todoId(todo: EducatorTodo): string {
  return `${todo.type}-${todo.assignment?.id ?? todo.quiz?.id ?? todo.html_url}`
}

export function todoTitle(todo: EducatorTodo): string {
  return todo.assignment?.name ?? todo.quiz?.title ?? ''
}

async function fetchTodos(): Promise<EducatorTodo[]> {
  const {json} = await doFetchApi<EducatorTodo[]>({
    path: '/api/v1/users/self/todo',
    params: {'include[]': 'grading_counts', per_page: 50},
  })
  return json ?? []
}

// The viewer's to-do list, and a way to take an item off it ("ignore" in
// Canvas terms: it stays off until something new happens on the item).
export function useEducatorTodos() {
  const queryClient = useQueryClient()
  const query = useQuery({queryKey: [EDUCATOR_TODOS_KEY], queryFn: fetchTodos})

  const dismiss = useMutation({
    mutationFn: (todo: EducatorTodo) => doFetchApi({path: todo.ignore, method: 'DELETE'}),
    onMutate: async todo => {
      await queryClient.cancelQueries({queryKey: [EDUCATOR_TODOS_KEY]})
      const before = queryClient.getQueryData<EducatorTodo[]>([EDUCATOR_TODOS_KEY])
      queryClient.setQueryData<EducatorTodo[]>([EDUCATOR_TODOS_KEY], current =>
        (current ?? []).filter(item => todoId(item) !== todoId(todo)),
      )
      return {before}
    },
    onError: (_error, _todo, context) => {
      if (context?.before) queryClient.setQueryData([EDUCATOR_TODOS_KEY], context.before)
    },
  })

  return {...query, dismiss: dismiss.mutate}
}
