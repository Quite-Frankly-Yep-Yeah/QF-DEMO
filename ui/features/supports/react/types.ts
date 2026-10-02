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
  // IEP scanning is on and the viewer can manage plans; the account scans are saved under
  can_scan: boolean
  scan_account_id: string | null
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
  source: 'manual' | 'import' | 'scan'
  external_id: string | null
  version: number
  notes: string | null
  accommodations: Accommodation[]
  acknowledgements: {id: string; name: string; acknowledged: boolean}[]
  // the original IEPs this plan was read from, for people who may manage it
  scans: {id: number; filename: string | null; applied_at: string | null}[]
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

// a student search also says the SIS ID, to tell people with the same name apart
export type Person = {id: string; name: string; sis_user_id?: string | null}

// Supports::Import#as_api_json for an IEP scan (Supports::IepScan.preview_json)
export type ExtractionState = 'queued' | 'running' | 'ready' | 'failed'

export type ScanItem = {
  index: number
  line: number
  accommodation: string | null
  kind: Kind
  params: Parameters | null
  action: ImportAction | 'excluded'
  message: string | null
  source_quote: string
  page: number | null
  confidence: 'high' | 'medium' | 'low'
  errors: string[]
  included: boolean
}

// Supports::StudentMatcher::Match#to_h, as the import's `match`
export type ScanMatch = {
  state: 'confident' | 'ambiguous' | 'none'
  candidates: {
    id: string
    name: string
    sis_user_id: string | null
    reason: 'id' | 'name' | 'partial'
  }[]
  student_id_on_doc: string | null
}

export type ScanRecord = {
  id: number
  filename: string | null
  format: 'iep_scan'
  workflow_state: 'previewed' | 'applied' | 'undone' | 'discarded'
  created_at: string | null
  applied_at: string | null
  undone_at: string | null
  extraction_state: ExtractionState
  extraction_error: string | null
  student: Person | null
  plan_id: number | null
  batch_id: number | null
  match: ScanMatch | null
  summary: Partial<Record<ImportAction, number>> & {blocking?: number}
  rows: ScanItem[]
  scan: {
    student_name_on_doc?: string | null
    dob_on_doc?: string | null
    name_found?: boolean
    mismatch?: boolean
    acknowledged_mismatch?: boolean
    unmapped?: {text: string; page: number | null}[]
    keep_unmapped?: number[]
    plan_type?: string | null
    start_date?: string | null
    end_date?: string | null
  }
}

// PUT /api/v1/supports/imports/:id/review
export type ReviewEdits = {
  items?: {index: number; included?: boolean; params?: Parameters}[]
  plan?: {plan_type?: string; start_date?: string; end_date?: string}
  keep_unmapped?: number[]
  acknowledged_mismatch?: boolean
}

// GET/POST /api/v1/supports/scan_batches
export type ScanBatch = {
  id: number
  files: ScanRecord[]
  counts: {
    reading: number
    ready: number
    failed: number
    confirmed: number
    applied: number
    skipped: number
  }
}
