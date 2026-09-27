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

// window.ENV.SUPPORTS (Supports::CaseloadController#page)
export type SupportsConfig = {
  can_see_all: boolean
  can_import: boolean
  import_accounts: {id: string; name: string}[]
  can_manage_catalog: boolean
  record_mode: 'classroom_layer' | 'system_of_record'
}

export type Parameters = {
  multiplier?: number | string
  minutes?: number | string
  percent?: number | string
  mode?: 'extend_finish' | 'lower_daily'
  attempts?: number | string
  every_days?: number | string
  setting?: 'high_contrast' | 'use_dyslexic_font'
}

export type Kind =
  | 'extended_time'
  | 'extended_deadlines'
  | 'extra_attempts'
  | 'reduced_workload'
  | 'check_ins'
  | 'display'
  | 'informational'

// GET /api/v1/supports/catalog
export type CatalogType = {
  id: number
  name: string
  kind: Kind
  kind_label: string
  instructions: string | null
  default_parameters: Parameters
  position: number
}

export type Catalog = {
  types: CatalogType[]
  kinds: {kind: Kind; label: string}[]
  can_manage: boolean
}

// Supports::StudentAccommodation#editor_json
export type Accommodation = {
  id: number
  name: string
  kind: Kind
  details: string | null
  instructions: string | null
  teacher_note: string | null
  accommodation_type_id: number
  parameters: Parameters
  course_ids: number[]
  start_date: string | null
  end_date: string | null
  last_verified_at: string | null
}

export type PlanType = 'iep' | '504' | 'el' | 'other'

export type Plan = {
  id: string
  plan_type: PlanType
  type_label: string
  workflow_state: 'active' | 'archived'
  school: {id: string; name: string}
  start_date: string | null
  end_date: string | null
  case_manager: {id: string; name: string} | null
  source: 'manual' | 'import'
  external_id: string | null
  version: number
  notes: string | null
  accommodations: Accommodation[]
  acknowledgements: {id: string; name: string; acknowledged: boolean}[]
}

// GET /api/v1/supports/students/:id (Supports::PlanEditor#as_json)
export type StudentPlans = {
  student: {id: string; name: string; sortable_name: string}
  can_manage: boolean
  plans: Plan[]
  team: {id: string; name: string; case_manager: boolean}[]
  schools: {id: string; name: string}[]
  courses: {id: string; name: string}[]
  catalog: CatalogType[]
}

// GET /api/v1/supports/caseload
export type CaseloadRow = {
  student: {id: string; name: string; sortable_name: string}
  assigned: boolean
  plans: {
    id: string
    plan_type: PlanType
    type_label: string
    end_date: string | null
    case_manager: string | null
  }[]
  next_review: string | null
  accommodations: number
  unacknowledged: number
}

export type ImportAction = 'create_plan' | 'update_plan' | 'add' | 'update' | 'unchanged' | 'error'

// Supports::Import#as_api_json
export type ImportRecord = {
  id: number
  filename: string | null
  format: string
  workflow_state: 'previewed' | 'applied' | 'undone' | 'discarded'
  created_at: string | null
  applied_at: string | null
  undone_at: string | null
  summary: Partial<Record<ImportAction, number>>
  rows: {
    line: number
    student: string | null
    plan_type: string | null
    accommodation: string | null
    action: ImportAction
    message: string | null
  }[]
}

export type Person = {id: string; name: string}
