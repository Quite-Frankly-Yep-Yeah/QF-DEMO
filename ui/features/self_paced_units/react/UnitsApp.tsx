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
import {
  addItem,
  addUnit,
  deleteItem,
  deleteUnit,
  listExisting,
  loadSetup,
  rewriteRequirements,
  saveItem,
  updateItem,
  updateUnit,
  type Existing,
} from './api'
import type {Item, NewItem, Role, Setup, Unit, UnitsConfig} from './types'
import {DANGER, INK, PAPER, SUBTLE} from '@canvas/material'
import {useMaterialPage} from '@canvas/material/useMaterialPage'

type Skill = Setup['skills'][number]

const I18n = createI18nScope('self_paced_units')

const ROBOTO = "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const DEFAULT_COLOR = '#1565C0'
const ELEVATION = {
  1: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
  4: '0 2px 5px rgba(0,0,0,0.26), 0 2px 10px rgba(0,0,0,0.16)',
}

const TYPE_LABEL: Record<string, () => string> = {
  WikiPage: () => I18n.t('Lesson'),
  'Quizzes::Quiz': () => I18n.t('Quiz'),
  Assignment: () => I18n.t('Assignment'),
  DiscussionTopic: () => I18n.t('Discussion'),
  Attachment: () => I18n.t('File'),
  ExternalUrl: () => I18n.t('Link'),
  ExternalTool: () => I18n.t('Tool'),
  ContextModuleSubHeader: () => I18n.t('Header'),
}

const ROLES: {value: Role; label: () => string}[] = [
  {value: 'instruction', label: () => I18n.t('Lesson')},
  {value: 'practice', label: () => I18n.t('Practice')},
  {value: 'check', label: () => I18n.t('Check')},
  {value: 'pretest', label: () => I18n.t('Pretest')},
  {value: 'none', label: () => I18n.t('Not counted')},
]

const STYLES = `
.sp-un-row:hover { background: rgba(0,0,0,0.03); }
.sp-un button:focus-visible, .sp-un select:focus-visible, .sp-un input:focus-visible, .sp-un a:focus-visible { outline: 2px solid #212121; outline-offset: 2px; }
`

const buttonStyle = (primary?: string): React.CSSProperties => ({
  padding: '6px 12px',
  border: primary ? 'none' : '1px solid rgba(0,0,0,0.24)',
  borderRadius: 2,
  background: primary ?? '#fff',
  color: primary ? '#fff' : INK.primary,
  fontFamily: ROBOTO,
  fontSize: '0.8125rem',
  fontWeight: 500,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
})

const iconButton: React.CSSProperties = {
  border: 'none',
  background: 'none',
  padding: '4px 8px',
  fontSize: '1rem',
  cursor: 'pointer',
  color: INK.secondary,
}

function minutesOf(item: Item): number {
  return item.estimated_minutes ?? item.suggested_minutes ?? 0
}

function sum(units: Unit[] | Item[], pick: (item: Item) => number): number {
  return (units as Array<Unit | Item>).reduce(
    (total, entry) =>
      total + ('items' in entry ? entry.items.reduce((n, item) => n + pick(item), 0) : pick(entry)),
    0,
  )
}

function Switch({on, label, onToggle}: {on: boolean; label: string; onToggle: () => void}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={on ? I18n.t('Published') : I18n.t('Not published')}
      onClick={onToggle}
      style={{
        width: 36,
        height: 14,
        borderRadius: 7,
        border: 'none',
        padding: 0,
        position: 'relative',
        background: on ? '#81C784' : '#BDBDBD',
        cursor: 'pointer',
        flex: 'none',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -3,
          left: on ? 16 : 0,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: on ? '#2E7D32' : SUBTLE,
          boxShadow: ELEVATION[1],
          transition: 'left 0.15s',
        }}
      />
    </button>
  )
}

// The Units page: the course's structure, in order, with what each item is
// for and how long it takes. Replaces the modules page for teachers of a
// Course Player course.
export default function UnitsApp({config}: {config: UnitsConfig}) {
  useMaterialPage()
  const courseId = config.course.id
  const color = config.course.color || DEFAULT_COLOR
  const [setup, setSetup] = useState<Setup | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [newName, setNewName] = useState('')

  const reload = useCallback(async () => {
    try {
      setSetup(await loadSetup(config.setup_url))
      setError('')
    } catch {
      setError(I18n.t("The units didn't load."))
    }
  }, [config.setup_url])

  useEffect(() => {
    reload()
  }, [reload])

  // Runs a change, rewrites the requirements when the structure changed, then
  // shows the result.
  const change = async (work: () => Promise<unknown>, structural = true, done?: string) => {
    setError('')
    try {
      await work()
      if (structural) await rewriteRequirements(config.setup_url)
      await reload()
      if (done) setStatus(done)
    } catch {
      setError(I18n.t("That change didn't save. Reload and try again."))
      reload()
    }
  }

  if (!setup) {
    return (
      <p style={{padding: 32, fontFamily: ROBOTO}} role={error ? 'alert' : undefined}>
        {error || I18n.t('Loading units...')}
      </p>
    )
  }

  const units = setup.modules
  const items = sum(units, () => 1)
  const minutes = sum(units, minutesOf)

  const moveUnit = (index: number, by: number) =>
    change(() => updateUnit(courseId, units[index].id, {position: index + by + 1}))

  return (
    <div className="sp-un" style={{fontFamily: ROBOTO, paddingBottom: 48}}>
      <style>{STYLES}</style>
      <header
        style={{
          background: color,
          color: '#fff',
          borderRadius: '2px 2px 0 0',
          boxShadow: ELEVATION[4],
          padding: '28px 32px 72px',
        }}
      >
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 16, opacity: 0.92}}>
          <a href={config.home_url} style={{color: '#fff'}}>
            {config.course.name}
          </a>
          <span style={{flex: 1}} />
          <a href={config.classic_url} style={{color: '#fff'}}>
            {I18n.t('Standard modules page')}
          </a>
        </div>
        <h1
          style={{
            margin: '8px 0 0',
            fontFamily: ROBOTO,
            fontWeight: 300,
            fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
            lineHeight: 1.1,
            color: '#fff',
          }}
        >
          {I18n.t('Units')}
        </h1>
      </header>

      <div style={{padding: '0 clamp(12px, 3vw, 32px)', maxWidth: '64rem'}}>
        <section
          aria-label={I18n.t('Summary')}
          style={{
            background: PAPER,
            borderRadius: 2,
            boxShadow: ELEVATION[4],
            margin: '-40px 0 24px',
            padding: '16px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px 32px',
          }}
        >
          <span>
            <strong style={{fontSize: '1.5rem', fontWeight: 300}}>{units.length}</strong>{' '}
            {I18n.t({one: 'unit', other: 'units'}, {count: units.length})}
          </span>
          <span>
            <strong style={{fontSize: '1.5rem', fontWeight: 300}}>{items}</strong>{' '}
            {I18n.t({one: 'item', other: 'items'}, {count: items})}
          </span>
          <span>
            <strong style={{fontSize: '1.5rem', fontWeight: 300}}>
              {Math.round(minutes / 6) / 10}
            </strong>{' '}
            {I18n.t('hours of work')}
          </span>
          <span style={{flex: 1}} />
          <form
            onSubmit={event => {
              event.preventDefault()
              const name = newName.trim()
              if (!name) return
              setNewName('')
              change(() => addUnit(courseId, name), true, I18n.t('Added %{name}.', {name}))
            }}
            style={{display: 'flex', gap: 8}}
          >
            <input
              value={newName}
              onChange={event => setNewName(event.target.value)}
              placeholder={I18n.t('Name of a new unit')}
              aria-label={I18n.t('Name of a new unit')}
              style={{padding: '6px 8px', minWidth: '12rem'}}
            />
            <button type="submit" style={buttonStyle(color)}>
              {I18n.t('Add unit')}
            </button>
          </form>
        </section>

        <div role="status" style={{minHeight: '1.5em', color: INK.secondary}}>
          {status}
        </div>
        {error && (
          <p role="alert" style={{color: DANGER}}>
            {error}
          </p>
        )}

        {units.length === 0 && (
          <p data-testid="units-empty" style={{color: INK.secondary, fontSize: '1.125rem'}}>
            {I18n.t(
              'No units yet. A unit is a group of lessons and practice that students work through in order. Name your first one above.',
            )}
          </p>
        )}

        {units.map((unit, index) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            number={index + 1}
            color={color}
            first={index === 0}
            last={index === units.length - 1}
            courseId={courseId}
            setupUrl={config.setup_url}
            skills={setup.skills}
            change={change}
            onMove={by => moveUnit(index, by)}
          />
        ))}
      </div>
    </div>
  )
}

type Change = (work: () => Promise<unknown>, structural?: boolean, done?: string) => Promise<void>

function UnitCard({
  unit,
  number,
  color,
  first,
  last,
  courseId,
  setupUrl,
  skills,
  change,
  onMove,
}: {
  unit: Unit
  number: number
  color: string
  first: boolean
  last: boolean
  courseId: string
  setupUrl: string
  skills: Skill[]
  change: Change
  onMove: (by: number) => void
}) {
  const [open, setOpen] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(unit.name)
  const [adding, setAdding] = useState(false)
  const headingId = `unit-${unit.id}`
  const minutes = sum([unit], minutesOf)

  return (
    <section
      aria-labelledby={headingId}
      style={{
        background: PAPER,
        borderRadius: 2,
        boxShadow: ELEVATION[1],
        borderLeft: `4px solid ${color}`,
        margin: '0 0 20px',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px'}}>
        <span style={{fontSize: '1.75rem', fontWeight: 300, color, width: 32}}>{number}</span>
        <div style={{flex: 1, minWidth: 0}}>
          {renaming ? (
            <form
              onSubmit={event => {
                event.preventDefault()
                setRenaming(false)
                if (name.trim() && name !== unit.name) {
                  change(() => updateUnit(courseId, unit.id, {name: name.trim()}), false)
                }
              }}
              style={{display: 'flex', gap: 8}}
            >
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                aria-label={I18n.t('Unit name')}
                autoFocus={true}
                style={{flex: 1, padding: '4px 8px'}}
              />
              <button type="submit" style={buttonStyle(color)}>
                {I18n.t('Save')}
              </button>
            </form>
          ) : (
            <h2
              id={headingId}
              style={{
                margin: 0,
                fontFamily: ROBOTO,
                fontWeight: 400,
                fontSize: '1.25rem',
                color: INK.primary,
                overflowWrap: 'anywhere',
              }}
            >
              {unit.name}
            </h2>
          )}
          <div style={{color: INK.secondary, fontSize: '0.875rem'}}>
            {I18n.t({one: '1 item', other: '%{count} items'}, {count: unit.items.length})}
            {minutes > 0 ? ` · ${I18n.t('%{count} min', {count: minutes})}` : ''}
            {!unit.published && ` · ${I18n.t('Not published')}`}
          </div>
        </div>
        <Switch
          on={unit.published}
          label={I18n.t('Published: %{name}', {name: unit.name})}
          onToggle={() =>
            change(() => updateUnit(courseId, unit.id, {published: !unit.published}), false)
          }
        />
        <button
          type="button"
          style={iconButton}
          onClick={() => setRenaming(true)}
          aria-label={I18n.t('Rename %{name}', {name: unit.name})}
        >
          ✎
        </button>
        <button
          type="button"
          style={iconButton}
          disabled={first}
          onClick={() => onMove(-1)}
          aria-label={I18n.t('Move %{name} up', {name: unit.name})}
        >
          ↑
        </button>
        <button
          type="button"
          style={iconButton}
          disabled={last}
          onClick={() => onMove(1)}
          aria-label={I18n.t('Move %{name} down', {name: unit.name})}
        >
          ↓
        </button>
        <button
          type="button"
          style={iconButton}
          onClick={() => {
            // eslint-disable-next-line no-alert
            if (
              window.confirm(
                I18n.t('Delete %{name} and everything listed in it?', {name: unit.name}),
              )
            ) {
              change(() => deleteUnit(courseId, unit.id))
            }
          }}
          aria-label={I18n.t('Delete %{name}', {name: unit.name})}
        >
          ✕
        </button>
        <button
          type="button"
          style={iconButton}
          aria-expanded={open}
          aria-label={
            open
              ? I18n.t('Collapse %{name}', {name: unit.name})
              : I18n.t('Expand %{name}', {name: unit.name})
          }
          onClick={() => setOpen(value => !value)}
        >
          {open ? '▾' : '▸'}
        </button>
      </div>

      {open && (
        <div style={{borderTop: '1px solid rgba(0,0,0,0.08)'}}>
          {unit.items.length === 0 && (
            <p style={{margin: 0, padding: '12px 16px 12px 60px', color: INK.secondary}}>
              {I18n.t('Nothing in this unit yet.')}
            </p>
          )}
          <ol style={{listStyle: 'none', margin: 0, padding: 0}}>
            {unit.items.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                unitId={unit.id}
                courseId={courseId}
                setupUrl={setupUrl}
                skills={skills}
                first={index === 0}
                last={index === unit.items.length - 1}
                index={index}
                change={change}
              />
            ))}
          </ol>
          <div style={{padding: '8px 16px 16px 60px'}}>
            {adding ? (
              <AddItem
                courseId={courseId}
                color={color}
                onCancel={() => setAdding(false)}
                onAdd={async (item: NewItem) => {
                  setAdding(false)
                  await change(
                    async () => {
                      await addItem(courseId, unit.id, item)
                    },
                    true,
                    I18n.t('Added %{title}.', {title: item.title}),
                  )
                }}
              />
            ) : (
              <button type="button" style={buttonStyle()} onClick={() => setAdding(true)}>
                {I18n.t('Add item')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function ItemRow({
  item,
  unitId,
  courseId,
  setupUrl,
  skills,
  first,
  last,
  index,
  change,
}: {
  item: Item
  unitId: string
  courseId: string
  setupUrl: string
  skills: Skill[]
  first: boolean
  last: boolean
  index: number
  change: Change
}) {
  const isHeader = item.type === 'ContextModuleSubHeader'
  const [minutes, setMinutes] = useState(item.estimated_minutes?.toString() ?? '')
  useEffect(() => setMinutes(item.estimated_minutes?.toString() ?? ''), [item.estimated_minutes])

  const save = (patch: Partial<Item>) => change(() => saveItem(setupUrl, {...item, ...patch}), true)

  return (
    <li
      className="sp-un-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '4px 12px',
        padding: '8px 16px 8px 60px',
        borderTop: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 500,
          color: INK.secondary,
          width: '5.5rem',
        }}
      >
        {(TYPE_LABEL[item.type] ?? (() => item.type))()}
      </span>
      <a
        href={item.url}
        style={{
          flex: 1,
          minWidth: '10rem',
          overflowWrap: 'anywhere',
          color: INK.primary,
          fontWeight: isHeader ? 500 : 400,
        }}
      >
        {item.title}
      </a>
      {!isHeader && (
        <>
          <label>
            <span className="screenreader-only">
              {I18n.t('What %{title} is for', {title: item.title})}
            </span>
            <select
              value={item.role}
              onChange={event => save({role: event.target.value as Role})}
              style={{padding: '4px'}}
            >
              {ROLES.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label()}
                </option>
              ))}
            </select>
          </label>
          {skills.length > 0 && (item.role === 'instruction' || item.role === 'practice') && (
            <label>
              <span className="screenreader-only">
                {I18n.t('Skill %{title} teaches, skipped when a student masters it', {
                  title: item.title,
                })}
              </span>
              <select
                value={item.skill_id ?? ''}
                onChange={event => save({skill_id: event.target.value || null})}
                style={{padding: '4px', maxWidth: '12rem'}}
              >
                <option value="">{I18n.t('No skill')}</option>
                {skills.map(skill => (
                  <option key={skill.id} value={skill.id}>
                    {skill.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label style={{whiteSpace: 'nowrap'}}>
            <span className="screenreader-only">
              {I18n.t('Minutes for %{title}', {title: item.title})}
            </span>
            <input
              type="number"
              min={1}
              max={600}
              value={minutes}
              placeholder={item.suggested_minutes ? String(item.suggested_minutes) : ''}
              onChange={event => setMinutes(event.target.value)}
              onBlur={() => {
                const value = minutes === '' ? null : Number(minutes)
                if (value !== item.estimated_minutes) save({estimated_minutes: value})
              }}
              style={{width: '4.5rem', padding: '4px'}}
            />{' '}
            <span style={{color: INK.secondary, fontSize: '0.875rem'}}>{I18n.t('min')}</span>
          </label>
          <Switch
            on={item.published}
            label={I18n.t('Published: %{title}', {title: item.title})}
            onToggle={() =>
              change(
                () => updateItem(courseId, unitId, item.id, {published: !item.published}),
                false,
              )
            }
          />
        </>
      )}
      <button
        type="button"
        style={iconButton}
        disabled={first}
        aria-label={I18n.t('Move %{title} up', {title: item.title})}
        onClick={() => change(() => updateItem(courseId, unitId, item.id, {position: index}))}
      >
        ↑
      </button>
      <button
        type="button"
        style={iconButton}
        disabled={last}
        aria-label={I18n.t('Move %{title} down', {title: item.title})}
        onClick={() => change(() => updateItem(courseId, unitId, item.id, {position: index + 2}))}
      >
        ↓
      </button>
      <button
        type="button"
        style={iconButton}
        aria-label={I18n.t('Remove %{title} from the unit', {title: item.title})}
        onClick={() => change(() => deleteItem(courseId, unitId, item.id))}
      >
        ✕
      </button>
    </li>
  )
}

const KINDS = [
  {value: 'new_page', label: () => I18n.t('New lesson page'), existing: null},
  {value: 'new_quiz', label: () => I18n.t('New quiz'), existing: null},
  {value: 'new_assignment', label: () => I18n.t('New assignment'), existing: null},
  {value: 'page', label: () => I18n.t('Existing lesson page'), existing: 'page'},
  {value: 'quiz', label: () => I18n.t('Existing quiz'), existing: 'quiz'},
  {value: 'assignment', label: () => I18n.t('Existing assignment'), existing: 'assignment'},
  {value: 'header', label: () => I18n.t('Section header'), existing: null},
] as const

function AddItem({
  courseId,
  color,
  onAdd,
  onCancel,
}: {
  courseId: string
  color: string
  onAdd: (item: NewItem) => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('new_page')
  const [title, setTitle] = useState('')
  const [existing, setExisting] = useState<Existing[]>([])
  const [chosen, setChosen] = useState('')
  const spec = KINDS.find(k => k.value === kind)!

  useEffect(() => {
    setChosen('')
    if (!spec.existing) {
      setExisting([])
      return
    }
    listExisting(courseId, spec.existing)
      .then(setExisting)
      .catch(() => setExisting([]))
  }, [courseId, spec.existing])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (spec.existing) {
      const found = existing.find(e => e.id === chosen)
      if (found) onAdd({kind: spec.existing, id: found.id, title: found.title})
    } else if (title.trim()) {
      onAdd({
        kind: kind as 'new_page' | 'new_quiz' | 'new_assignment' | 'header',
        title: title.trim(),
      })
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center'}}
    >
      <select
        value={kind}
        onChange={event => setKind(event.target.value as typeof kind)}
        aria-label={I18n.t('What to add')}
        style={{padding: '6px'}}
      >
        {KINDS.map(k => (
          <option key={k.value} value={k.value}>
            {k.label()}
          </option>
        ))}
      </select>
      {spec.existing ? (
        <select
          value={chosen}
          onChange={event => setChosen(event.target.value)}
          aria-label={I18n.t('Which one')}
          style={{padding: '6px', minWidth: '12rem'}}
        >
          <option value="">{I18n.t('Choose...')}</option>
          {existing.map(e => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder={I18n.t('Title')}
          aria-label={I18n.t('Title')}
          autoFocus={true}
          style={{padding: '6px 8px', minWidth: '14rem'}}
        />
      )}
      <button type="submit" style={buttonStyle(color)}>
        {I18n.t('Add')}
      </button>
      <button type="button" style={buttonStyle()} onClick={onCancel}>
        {I18n.t('Cancel')}
      </button>
    </form>
  )
}
