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

// Shapes returned by Onboarding::ProgressController.

export type TrackSummary = {
  key: string
  title: string
  url: string
  done_count: number
  total: number
}

export type OnboardingStep = {
  key: string
  title: string
  description: string
  url: string
  optional: boolean
  detectable: boolean
  detected: boolean | null
  completed_at: string | null
  dismissed_at: string | null
  done: boolean
}

export type OnboardingTrack = TrackSummary & {steps: OnboardingStep[]}
