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
import type {OnboardingTrack, TrackSummary} from './types'

const BASE = '/api/v1/users/self/onboarding'

export async function fetchTracks(): Promise<TrackSummary[]> {
  const {json} = await doFetchApi<{tracks: TrackSummary[]}>({path: BASE})
  return json?.tracks ?? []
}

export async function fetchTrack(track: string): Promise<OnboardingTrack> {
  const {json} = await doFetchApi<OnboardingTrack>({path: `${BASE}/${encodeURIComponent(track)}`})
  if (!json) throw new Error('empty response')
  return json
}

export async function markStep(
  track: string,
  step: string,
  body: {done?: boolean; dismissed?: boolean},
): Promise<OnboardingTrack> {
  const {json} = await doFetchApi<OnboardingTrack>({
    path: `${BASE}/${encodeURIComponent(track)}/steps/${encodeURIComponent(step)}`,
    method: 'PUT',
    body,
  })
  if (!json) throw new Error('empty response')
  return json
}

export async function resetTrack(track: string): Promise<OnboardingTrack> {
  const {json} = await doFetchApi<OnboardingTrack>({
    path: `${BASE}/${encodeURIComponent(track)}`,
    method: 'DELETE',
  })
  if (!json) throw new Error('empty response')
  return json
}
