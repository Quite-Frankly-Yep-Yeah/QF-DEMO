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

import React, {useCallback, useEffect, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {INK} from '../../self_paced_home/react/material'
import ParametersFields from './ParametersFields'
import PersonPicker from './PersonPicker'
import ScanPanel from './ScanPanel'
import type {
  Accommodation,
  CatalogType,
  Parameters,
  Person,
  Plan,
  PlanType,
  StudentPlans as Data,
} from './types'
import {button, Card, field, flatButton, formatDate, Label, messageFrom, muted, Status} from './ui'
import AppliedCard from './AppliedCard'

const I18n = createI18nScope('supports')

const STAFF_URL = '/api/v1/supports/staff'

const planTypeOptions = (): {value: PlanType; label: string}[] => [
  {value: 'iep', label: I18n.t('IEP')},
  {value: '504', label: I18n.t('504 plan')},
  {value: 'el', label: I18n.t('English-learner plan')},
  {value: 'other', label: I18n.t('Other plan')},
]

type PlanDraft = {
  plan_type: PlanType
  account_id: string
  start_date: string
  end_date: string
  case_manager: Person | null
  external_id: string
  notes: string
  workflow_state: 'active' | 'archived'
}

function PlanForm({
  initial,
  schools,
  creating,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: PlanDraft
  schools: {id: string; name: string}[]
  creating: boolean
  busy: boolean
  onSubmit: (draft: PlanDraft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const set = (patch: Partial<PlanDraft>) => setDraft(current => ({...current, ...patch}))
  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        onSubmit(draft)
      }}
      style={{marginTop: 12}}
    >
      <Label text={I18n.t('Plan type')}>
        <select
          style={field}
          value={draft.plan_type}
          onChange={event => set({plan_type: event.target.value as PlanType})}
        >
          {planTypeOptions().map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Label>
      {creating && schools.length > 1 && (
        <Label text={I18n.t('School')}>
          <select
            style={field}
            value={draft.account_id}
            onChange={event => set({account_id: event.target.value})}
          >
            {schools.map(school => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </Label>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
          gap: '0 12px',
        }}
      >
        <Label text={I18n.t('Start date')}>
          <input
            style={field}
            type="date"
            value={draft.start_date}
            onChange={event => set({start_date: event.target.value})}
          />
        </Label>
        <Label text={I18n.t('Next review')}>
          <input
            style={field}
            type="date"
            value={draft.end_date}
            onChange={event => set({end_date: event.target.value})}
          />
        </Label>
      </div>
      <PersonPicker
        label={I18n.t('Case manager')}
        url={STAFF_URL}
        resultKey="staff"
        selected={draft.case_manager}
        onSelect={person => set({case_manager: person})}
      />
      <Label text={I18n.t("District's plan ID (optional)")}>
        <input
          style={field}
          value={draft.external_id}
          onChange={event => set({external_id: event.target.value})}
        />
      </Label>
      <Label text={I18n.t('Notes for the support team (not shown to teachers)')}>
        <textarea
          style={{...field, minHeight: 88}}
          value={draft.notes}
          onChange={event => set({notes: event.target.value})}
        />
      </Label>
      {!creating && (
        <Label text={I18n.t('Status')}>
          <select
            style={field}
            value={draft.workflow_state}
            onChange={event =>
              set({workflow_state: event.target.value as PlanDraft['workflow_state']})
            }
          >
            <option value="active">{I18n.t('Active')}</option>
            <option value="archived">{I18n.t('Archived (no longer in effect)')}</option>
          </select>
        </Label>
      )}
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
        <button type="submit" style={button} disabled={busy}>
          {creating ? I18n.t('Create plan') : I18n.t('Save plan')}
        </button>
        <button type="button" style={flatButton} onClick={onCancel}>
          {I18n.t('Cancel')}
        </button>
      </div>
    </form>
  )
}

type AccommodationDraft = {
  accommodation_type_id: string
  parameters: Parameters
  all_courses: boolean
  course_ids: string[]
  teacher_note: string
  start_date: string
  end_date: string
  verified: boolean
}

function AccommodationForm({
  catalog,
  courses,
  initial,
  creating,
  busy,
  onSubmit,
  onCancel,
}: {
  catalog: CatalogType[]
  courses: {id: string; name: string}[]
  initial: AccommodationDraft
  creating: boolean
  busy: boolean
  onSubmit: (draft: AccommodationDraft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const set = (patch: Partial<AccommodationDraft>) => setDraft(current => ({...current, ...patch}))
  const type = catalog.find(item => String(item.id) === draft.accommodation_type_id)
  const idPrefix = `acc-${initial.accommodation_type_id || 'new'}`

  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        onSubmit(draft)
      }}
      style={{marginTop: 12, padding: 12, background: '#F5F5F5', borderRadius: 2}}
    >
      {creating ? (
        <Label text={I18n.t('Accommodation')}>
          <select
            style={field}
            value={draft.accommodation_type_id}
            onChange={event => {
              const chosen = catalog.find(item => String(item.id) === event.target.value)
              set({
                accommodation_type_id: event.target.value,
                parameters: chosen?.default_parameters ?? {},
              })
            }}
          >
            <option value="">{I18n.t('Choose from the catalog')}</option>
            {catalog.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Label>
      ) : (
        <p style={{margin: '0 0 12px', fontWeight: 500}}>{type?.name}</p>
      )}
      {type && (
        <>
          <p style={{...muted, margin: '-4px 0 12px'}}>{type.kind_label}</p>
          <ParametersFields
            kind={type.kind}
            value={draft.parameters}
            onChange={parameters => set({parameters})}
            idPrefix={idPrefix}
          />
        </>
      )}
      <fieldset style={{border: 'none', margin: '0 0 12px', padding: 0}}>
        <legend style={{fontWeight: 500, marginBottom: 4}}>{I18n.t('Classes')}</legend>
        <label style={{display: 'block', minHeight: 32}}>
          <input
            type="radio"
            name={`${idPrefix}-scope`}
            checked={draft.all_courses}
            onChange={() => set({all_courses: true})}
          />{' '}
          {I18n.t('All of the student’s classes')}
        </label>
        <label style={{display: 'block', minHeight: 32}}>
          <input
            type="radio"
            name={`${idPrefix}-scope`}
            checked={!draft.all_courses}
            onChange={() => set({all_courses: false})}
          />{' '}
          {I18n.t('Only these classes')}
        </label>
        {!draft.all_courses && (
          <div style={{paddingLeft: 24}}>
            {courses.map(course => (
              <label key={course.id} style={{display: 'block', minHeight: 32}}>
                <input
                  type="checkbox"
                  checked={draft.course_ids.includes(course.id)}
                  onChange={event =>
                    set({
                      course_ids: event.target.checked
                        ? [...draft.course_ids, course.id]
                        : draft.course_ids.filter(id => id !== course.id),
                    })
                  }
                />{' '}
                {course.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <Label text={I18n.t('Note for teachers')}>
        <textarea
          style={{...field, minHeight: 72}}
          value={draft.teacher_note}
          onChange={event => set({teacher_note: event.target.value})}
          placeholder={I18n.t('What the teacher needs to do, in plain words')}
        />
      </Label>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
          gap: '0 12px',
        }}
      >
        <Label text={I18n.t('Starts (optional)')}>
          <input
            style={field}
            type="date"
            value={draft.start_date}
            onChange={event => set({start_date: event.target.value})}
          />
        </Label>
        <Label text={I18n.t('Ends (optional)')}>
          <input
            style={field}
            type="date"
            value={draft.end_date}
            onChange={event => set({end_date: event.target.value})}
          />
        </Label>
      </div>
      {!creating && (
        <label style={{display: 'block', minHeight: 32, marginBottom: 8}}>
          <input
            type="checkbox"
            checked={draft.verified}
            onChange={event => set({verified: event.target.checked})}
          />{' '}
          {I18n.t('I checked this against the current plan')}
        </label>
      )}
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
        <button type="submit" style={button} disabled={busy || !draft.accommodation_type_id}>
          {creating ? I18n.t('Add accommodation') : I18n.t('Save accommodation')}
        </button>
        <button type="button" style={flatButton} onClick={onCancel}>
          {I18n.t('Cancel')}
        </button>
      </div>
    </form>
  )
}

const accommodationDraft = (row?: Accommodation): AccommodationDraft => ({
  accommodation_type_id: row ? String(row.accommodation_type_id) : '',
  parameters: row?.parameters ?? {},
  all_courses: !row || row.course_ids.length === 0,
  course_ids: row ? row.course_ids.map(String) : [],
  teacher_note: row?.teacher_note ?? '',
  start_date: row?.start_date ?? '',
  end_date: row?.end_date ?? '',
  verified: false,
})

const accommodationBody = (draft: AccommodationDraft) => ({
  accommodation_type_id: draft.accommodation_type_id,
  parameters: draft.parameters,
  course_ids: draft.all_courses ? [] : draft.course_ids,
  teacher_note: draft.teacher_note,
  start_date: draft.start_date || null,
  end_date: draft.end_date || null,
  verified: draft.verified,
})

const planBody = (draft: PlanDraft) => ({
  plan_type: draft.plan_type,
  account_id: draft.account_id,
  start_date: draft.start_date || null,
  end_date: draft.end_date || null,
  case_manager_id: draft.case_manager?.id ?? '',
  external_id: draft.external_id,
  notes: draft.notes,
  workflow_state: draft.workflow_state,
})

function PlanCard({
  plan,
  data,
  busy,
  run,
}: {
  plan: Plan
  data: Data
  busy: boolean
  run: (request: () => Promise<{json?: Data}>, done: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingRow, setEditingRow] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const read = plan.acknowledgements.filter(teacher => teacher.acknowledged).length
  const headingId = `plan-${plan.id}`
  const courseName = (id: number) =>
    data.courses.find(course => course.id === String(id))?.name ?? ''

  const call = (method: string, path: string, body?: object) => () =>
    doFetchApi<Data>({path, method, body})

  return (
    <Card
      id={headingId}
      title={
        <>
          {plan.type_label}
          {plan.workflow_state === 'archived' && (
            <span style={{...muted, marginLeft: 8}}>{I18n.t('Archived')}</span>
          )}
        </>
      }
      aside={
        data.can_manage && !editing ? (
          <button type="button" style={flatButton} onClick={() => setEditing(true)}>
            {I18n.t('Edit plan')}
          </button>
        ) : null
      }
    >
      {editing ? (
        <PlanForm
          creating={false}
          busy={busy}
          schools={data.schools}
          initial={{
            plan_type: plan.plan_type,
            account_id: plan.school.id,
            start_date: plan.start_date ?? '',
            end_date: plan.end_date ?? '',
            case_manager: plan.case_manager,
            external_id: plan.external_id ?? '',
            notes: plan.notes ?? '',
            workflow_state: plan.workflow_state,
          }}
          onCancel={() => setEditing(false)}
          onSubmit={async draft => {
            if (
              await run(
                call('PUT', `/api/v1/supports/plans/${plan.id}`, planBody(draft)),
                I18n.t('Plan saved.'),
              )
            )
              setEditing(false)
          }}
        />
      ) : (
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'max-content 1fr',
            gap: '4px 16px',
            margin: 0,
          }}
        >
          <dt style={muted}>{I18n.t('School')}</dt>
          <dd style={{margin: 0}}>{plan.school.name}</dd>
          <dt style={muted}>{I18n.t('Dates')}</dt>
          <dd style={{margin: 0}}>
            {plan.start_date || plan.end_date
              ? I18n.t('%{start} to %{end}', {
                  start: formatDate(plan.start_date) || I18n.t('not set'),
                  end: formatDate(plan.end_date) || I18n.t('not set'),
                })
              : I18n.t('Not set')}
          </dd>
          <dt style={muted}>{I18n.t('Case manager')}</dt>
          <dd style={{margin: 0}}>{plan.case_manager?.name ?? I18n.t('None yet')}</dd>
          <dt style={muted}>{I18n.t('From')}</dt>
          <dd style={{margin: 0}}>
            {plan.source === 'import'
              ? I18n.t('District import (%{id})', {id: plan.external_id ?? ''})
              : I18n.t('Entered here')}
          </dd>
          {plan.notes && (
            <>
              <dt style={muted}>{I18n.t('Notes')}</dt>
              <dd style={{margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>
                {plan.notes}
              </dd>
            </>
          )}
        </dl>
      )}

      <h3 style={{margin: '20px 0 8px', fontWeight: 500, fontSize: '1rem', color: INK.primary}}>
        {I18n.t('Accommodations')}
      </h3>
      {plan.accommodations.length === 0 && <p style={muted}>{I18n.t('None yet.')}</p>}
      <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
        {plan.accommodations.map(row => (
          <li key={row.id} style={{padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.12)'}}>
            {editingRow === row.id ? (
              <AccommodationForm
                catalog={data.catalog}
                courses={data.courses}
                initial={accommodationDraft(row)}
                creating={false}
                busy={busy}
                onCancel={() => setEditingRow(null)}
                onSubmit={async draft => {
                  if (
                    await run(
                      call(
                        'PUT',
                        `/api/v1/supports/accommodations/${row.id}`,
                        accommodationBody(draft),
                      ),
                      I18n.t('Accommodation saved.'),
                    )
                  )
                    setEditingRow(null)
                }}
              />
            ) : (
              <div
                style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8}}
              >
                <div style={{minWidth: 0, flex: '1 1 16rem'}}>
                  <div style={{fontWeight: 500}}>{row.name}</div>
                  {row.details && <div>{row.details}</div>}
                  {row.teacher_note && (
                    <div style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>
                      {row.teacher_note}
                    </div>
                  )}
                  <div style={muted}>
                    {row.course_ids.length === 0
                      ? I18n.t('All classes')
                      : row.course_ids.map(courseName).join(', ')}
                    {row.last_verified_at
                      ? `. ${I18n.t('Checked %{date}.', {date: formatDate(row.last_verified_at)})}`
                      : ''}
                  </div>
                </div>
                {data.can_manage && (
                  <div style={{display: 'flex', gap: 4}}>
                    <button type="button" style={flatButton} onClick={() => setEditingRow(row.id)}>
                      {I18n.t('Edit')}
                    </button>
                    <button
                      type="button"
                      style={flatButton}
                      disabled={busy}
                      aria-label={I18n.t('Remove %{name}', {name: row.name})}
                      onClick={() =>
                        run(
                          call('DELETE', `/api/v1/supports/accommodations/${row.id}`),
                          I18n.t('Accommodation removed.'),
                        )
                      }
                    >
                      {I18n.t('Remove')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {data.can_manage && plan.workflow_state === 'active' && (
        <>
          {adding ? (
            <AccommodationForm
              catalog={data.catalog}
              courses={data.courses}
              initial={accommodationDraft()}
              creating={true}
              busy={busy}
              onCancel={() => setAdding(false)}
              onSubmit={async draft => {
                if (
                  await run(
                    call(
                      'POST',
                      `/api/v1/supports/plans/${plan.id}/accommodations`,
                      accommodationBody(draft),
                    ),
                    I18n.t('Accommodation added. Teachers will be asked to read the list again.'),
                  )
                )
                  setAdding(false)
              }}
            />
          ) : (
            <button type="button" style={{...button, marginTop: 8}} onClick={() => setAdding(true)}>
              {I18n.t('Add accommodation')}
            </button>
          )}
        </>
      )}

      {plan.workflow_state === 'active' && plan.accommodations.length > 0 && (
        <>
          <h3 style={{margin: '20px 0 8px', fontWeight: 500, fontSize: '1rem', color: INK.primary}}>
            {I18n.t('Teachers who have read the current list')}
          </h3>
          {plan.acknowledgements.length === 0 ? (
            <p style={muted}>{I18n.t('The student has no teachers yet.')}</p>
          ) : (
            <>
              <p style={{margin: '0 0 4px'}}>
                {I18n.t('%{read} of %{total}', {read, total: plan.acknowledgements.length})}
              </p>
              <ul style={{margin: 0, paddingLeft: 20}}>
                {plan.acknowledgements.map(teacher => (
                  <li key={teacher.id}>
                    {teacher.acknowledged
                      ? I18n.t('%{name}: read', {name: teacher.name})
                      : I18n.t('%{name}: not yet', {name: teacher.name})}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {data.can_manage && (
        <div style={{marginTop: 20}}>
          {confirmDelete ? (
            <div role="group" aria-label={I18n.t('Confirm deleting the plan')}>
              <p style={{margin: '0 0 8px'}}>
                {I18n.t(
                  'Delete this plan and its accommodations? Use Archived instead if the plan ended; delete only a plan entered by mistake.',
                )}
              </p>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
                <button
                  type="button"
                  style={button}
                  disabled={busy}
                  onClick={() =>
                    run(
                      call('DELETE', `/api/v1/supports/plans/${plan.id}`),
                      I18n.t('Plan deleted.'),
                    )
                  }
                >
                  {I18n.t('Yes, delete it')}
                </button>
                <button type="button" style={flatButton} onClick={() => setConfirmDelete(false)}>
                  {I18n.t('Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" style={flatButton} onClick={() => setConfirmDelete(true)}>
              {I18n.t('Delete plan')}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

// One student's plans, accommodations and support team, for the people who
// work on them (docs/teacher-workflow-plan.md Phase 1).
export default function StudentPlans({
  studentId,
  onBack,
  scanAccountId = null,
}: {
  studentId: string
  onBack: () => void
  // set when IEP scanning is on: the account the scan is saved under
  scanAccountId?: string | null
}) {
  const [data, setData] = useState<Data | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [teamPick, setTeamPick] = useState<Person | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setFailed(false)
    doFetchApi<Data>({path: `/api/v1/supports/students/${encodeURIComponent(studentId)}`})
      .then(({json}) => {
        if (!cancelled && json) setData(json)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  const run = useCallback(async (request: () => Promise<{json?: Data}>, done: string) => {
    setBusy(true)
    setMessage('')
    try {
      const {json} = await request()
      if (json) setData(json)
      setMessage(done)
      return true
    } catch (error) {
      setMessage(await messageFrom(error))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const back = (
    <button type="button" style={{...flatButton, paddingLeft: 0}} onClick={onBack}>
      {I18n.t('Back to caseload')}
    </button>
  )

  if (failed) {
    return (
      <div>
        {back}
        <p role="alert">{I18n.t("You can't see this student's plan, or it didn't load.")}</p>
      </div>
    )
  }
  if (!data) return <p>{I18n.t('Loading...')}</p>

  const studentPath = `/api/v1/supports/students/${encodeURIComponent(studentId)}`

  return (
    <div style={{display: 'grid', gap: 'clamp(12px, 3vw, 20px)'}}>
      <div>{back}</div>
      <Card id="supports-student" title={data.student.name}>
        <p style={{...muted, margin: '0 0 12px'}}>
          {I18n.t(
            'Plan details are private to the support team. Teachers only see the accommodations for the classes they teach.',
          )}
        </p>
        <h3 style={{margin: '0 0 8px', fontWeight: 500, fontSize: '1rem', color: INK.primary}}>
          {I18n.t('Support team')}
        </h3>
        {data.team.length === 0 ? (
          <p style={muted}>{I18n.t('Nobody is assigned yet.')}</p>
        ) : (
          <ul style={{listStyle: 'none', margin: '0 0 12px', padding: 0}}>
            {data.team.map(member => (
              <li
                key={member.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 36,
                }}
              >
                <span>
                  {member.case_manager
                    ? I18n.t('%{name} (case manager)', {name: member.name})
                    : member.name}
                </span>
                {data.can_manage && !member.case_manager && (
                  <button
                    type="button"
                    style={flatButton}
                    disabled={busy}
                    aria-label={I18n.t('Remove %{name} from the team', {name: member.name})}
                    onClick={() =>
                      run(
                        () =>
                          doFetchApi<Data>({
                            path: `${studentPath}/team/${member.id}`,
                            method: 'DELETE',
                          }),
                        I18n.t('Removed from the team.'),
                      )
                    }
                  >
                    {I18n.t('Remove')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {data.can_manage && (
          <div style={{maxWidth: '28rem'}}>
            <PersonPicker
              label={I18n.t('Add someone to the team')}
              url={STAFF_URL}
              resultKey="staff"
              selected={teamPick}
              onSelect={setTeamPick}
            />
            {teamPick && (
              <button
                type="button"
                style={button}
                disabled={busy}
                onClick={async () => {
                  if (
                    await run(
                      () =>
                        doFetchApi<Data>({
                          path: `${studentPath}/team/${teamPick.id}`,
                          method: 'PUT',
                        }),
                      I18n.t('%{name} can now see this student’s accommodations.', {
                        name: teamPick.name,
                      }),
                    )
                  )
                    setTeamPick(null)
                }}
              >
                {I18n.t('Add to team')}
              </button>
            )}
          </div>
        )}
        <Status message={message} />
      </Card>

      {data.plans.length === 0 && !creating && (
        <p style={{margin: 0}}>{I18n.t('This student has no support plan yet.')}</p>
      )}
      {data.plans.map(plan => (
        <PlanCard key={plan.id} plan={plan} data={data} busy={busy} run={run} />
      ))}
      {data.plans.length > 0 && <AppliedCard studentId={studentId} />}

      {data.can_manage &&
        (creating ? (
          <Card id="supports-new-plan" title={I18n.t('New plan')}>
            <PlanForm
              creating={true}
              busy={busy}
              schools={data.schools}
              initial={{
                plan_type: '504',
                account_id: data.schools[0]?.id ?? '',
                start_date: '',
                end_date: '',
                case_manager: null,
                external_id: '',
                notes: '',
                workflow_state: 'active',
              }}
              onCancel={() => setCreating(false)}
              onSubmit={async draft => {
                if (
                  await run(
                    () =>
                      doFetchApi<Data>({
                        path: `${studentPath}/plans`,
                        method: 'POST',
                        body: planBody(draft),
                      }),
                    I18n.t('Plan created.'),
                  )
                )
                  setCreating(false)
              }}
            />
          </Card>
        ) : (
          <div>
            <button type="button" style={button} onClick={() => setCreating(true)}>
              {I18n.t('Start a new plan')}
            </button>
          </div>
        ))}
      {data.can_manage && scanAccountId && (
        <ScanPanel
          accountId={scanAccountId}
          student={{id: data.student.id, name: data.student.name}}
        />
      )}
    </div>
  )
}
