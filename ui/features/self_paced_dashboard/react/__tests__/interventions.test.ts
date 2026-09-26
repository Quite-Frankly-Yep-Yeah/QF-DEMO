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

import {describeEntry, itemActions} from '../interventions'
import type {DetailItem, LogEntry, Tools} from '../types'

const ALL: Tools = {
  unlock: true,
  mark_complete: true,
  exempt: true,
  exempt_graded: true,
  extra_attempts: true,
  reset_attempt: true,
  adjust_target: true,
  note: true,
  message: true,
}

const MENTOR: Tools = {...ALL, exempt_graded: false, extra_attempts: false, reset_attempt: false}

function item(overrides: Partial<DetailItem> = {}): DetailItem {
  return {
    id: '101',
    title: '1.1 Check',
    type: 'Quizzes::Quiz',
    module: 'Unit 1',
    active_seconds: 0,
    last_viewed_at: null,
    completed: false,
    overrides: [],
    graded: true,
    attempts_limited: true,
    ...overrides,
  }
}

const labels = (detail: DetailItem, tools: Tools) => itemActions(detail, tools).map(a => a.label)

describe('itemActions', () => {
  it('offers a grader everything for a graded quiz', () => {
    expect(labels(item(), ALL)).toEqual([
      'Unlock',
      'Mark complete',
      'Exempt',
      'Give extra tries',
      'Reset last try',
    ])
  })

  it("keeps a mentor to what doesn't change grades", () => {
    expect(labels(item(), MENTOR)).toEqual(['Unlock', 'Mark complete'])
    expect(labels(item({graded: false, attempts_limited: false}), MENTOR)).toEqual([
      'Unlock',
      'Mark complete',
      'Exempt',
    ])
  })

  it('offers the undo for an override already in place', () => {
    const actions = itemActions(item({overrides: ['unlock', 'exempt']}), ALL)

    expect(actions.map(a => a.label)).toContain('Lock again')
    expect(actions.find(a => a.label === 'Undo exemption')).toMatchObject({
      kind: 'undo',
      overrideKind: 'exempt',
    })
    // an exempt item is already done, so marking it complete means nothing
    expect(actions.map(a => a.label)).not.toContain('Mark complete')
  })
})

describe('describeEntry', () => {
  const entry = (overrides: Partial<LogEntry>): LogEntry => ({
    id: '1',
    kind: 'unlock',
    created_at: '2026-09-24T14:00:00Z',
    actor: {id: '9', name: 'Ms. Ortiz'},
    real_actor: null,
    item: {id: '101', title: '1.1 Check'},
    reason: null,
    payload: {},
    bulk: false,
    ...overrides,
  })

  it('says what was done in plain words', () => {
    expect(describeEntry(entry({kind: 'extra_attempts', payload: {attempts: 2}}))).toBe(
      'Gave 2 extra tries on 1.1 Check',
    )
    expect(
      describeEntry(
        entry({kind: 'reset_attempt', payload: {reset_attempt: {attempt: 1, score: 4}}}),
      ),
    ).toBe('Reset try 1 on 1.1 Check (it scored 4)')
    expect(describeEntry(entry({kind: 'exempt', payload: {excused: true}}))).toBe(
      'Exempted 1.1 Check and excused its grade',
    )
    expect(describeEntry(entry({kind: 'undo', payload: {override_kind: 'unlock'}}))).toBe(
      'Locked 1.1 Check again',
    )
    expect(describeEntry(entry({kind: 'message', item: null, payload: {subject: 'Hi'}}))).toBe(
      'Sent a message: Hi',
    )
  })
})
