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

import type {ScanBatch, ScanMatch, ScanRecord} from '../types'

export const scanRecord = (
  overrides: Partial<ScanRecord> = {},
  scan: Partial<ScanRecord['scan']> = {},
): ScanRecord => ({
  id: 5,
  filename: 'iep.pdf',
  format: 'iep_scan',
  workflow_state: 'previewed',
  created_at: null,
  applied_at: null,
  undone_at: null,
  extraction_state: 'ready',
  extraction_error: null,
  student: {id: '7', name: 'Pat Student'},
  plan_id: null,
  batch_id: null,
  match: null,
  summary: {add: 1, blocking: 0},
  rows: [
    {
      index: 0,
      line: 1,
      accommodation: 'Extended time on tests and quizzes',
      kind: 'extended_time',
      params: {multiplier: 1.5},
      action: 'add',
      message: null,
      source_quote: 'time and a half on tests',
      page: 3,
      confidence: 'high',
      errors: [],
      included: true,
    },
  ],
  scan: {
    student_name_on_doc: 'Pat Student',
    dob_on_doc: null,
    name_found: true,
    mismatch: false,
    acknowledged_mismatch: false,
    unmapped: [{text: 'Speech therapy 30 min weekly', page: 5}],
    keep_unmapped: [],
    plan_type: 'iep',
    start_date: '2026-09-01',
    end_date: '2027-06-15',
    ...scan,
  },
  ...overrides,
})

export const match = (
  state: ScanMatch['state'],
  candidates: ScanMatch['candidates'] = [],
  student_id_on_doc: string | null = null,
): ScanMatch => ({state, candidates, student_id_on_doc})

// a file in a batch that was read but has no student yet
export const unmatched = (id: number, filename: string, found: ScanMatch | null) =>
  scanRecord(
    {
      id,
      filename,
      student: null,
      batch_id: 1,
      match: found,
      rows: [],
      summary: {},
    },
    {student_name_on_doc: `Name on ${filename}`},
  )

export const batchOf = (files: ScanRecord[]): ScanBatch => ({
  id: 1,
  files,
  counts: {
    reading: files.filter(f => ['queued', 'running'].includes(f.extraction_state)).length,
    ready: files.filter(
      f => f.extraction_state === 'ready' && !f.student && f.workflow_state === 'previewed',
    ).length,
    failed: files.filter(f => f.extraction_state === 'failed').length,
    confirmed: files.filter(f => f.student && f.workflow_state === 'previewed').length,
    applied: files.filter(f => f.workflow_state === 'applied').length,
    skipped: files.filter(f => f.workflow_state === 'discarded').length,
  },
})
