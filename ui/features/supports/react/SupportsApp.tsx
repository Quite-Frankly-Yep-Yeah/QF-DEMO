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
import {ELEVATION, ink, ROBOTO, SURFACE} from '../../self_paced_home/react/material'
import CaseloadPanel from './CaseloadPanel'
import CatalogPanel from './CatalogPanel'
import ImportPanel from './ImportPanel'
import ScanPanel from './ScanPanel'
import StudentPlans from './StudentPlans'
import type {SupportsConfig} from './types'
import {BRAND, GUTTER, PAD, TAP} from './ui'
import {useMaterialPage} from '@canvas/material/useMaterialPage'

const I18n = createI18nScope('supports')

type Tab = 'caseload' | 'catalog' | 'import' | 'scan'

// Where the page is, kept in the address so the back button and a shared link
// both work: ?tab=catalog, or ?student_id=123 for one student's plans.
function readLocation(): {tab: Tab; studentId: string | null} {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab')
  return {
    tab: tab === 'catalog' || tab === 'import' || tab === 'scan' ? tab : 'caseload',
    studentId: params.get('student_id'),
  }
}

function writeLocation(tab: Tab, studentId: string | null) {
  const params = new URLSearchParams()
  if (tab !== 'caseload') params.set('tab', tab)
  if (studentId) params.set('student_id', studentId)
  const query = params.toString()
  window.history.pushState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
}

// The Supports page (docs/teacher-workflow-plan.md Phase 1): the caseload and
// each student's plans, the accommodation catalog, and imports.
export default function SupportsApp({config}: {config: SupportsConfig}) {
  useMaterialPage()
  const [{tab, studentId}, setPlace] = useState(readLocation)

  useEffect(() => {
    const onPop = () => setPlace(readLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((nextTab: Tab, nextStudent: string | null = null) => {
    writeLocation(nextTab, nextStudent)
    setPlace({tab: nextTab, studentId: nextStudent})
    window.scrollTo(0, 0)
  }, [])

  const tabs: {id: Tab; label: string}[] = [
    {id: 'caseload', label: I18n.t('Caseload')},
    {id: 'catalog', label: I18n.t('Catalog')},
    ...(config.can_import ? [{id: 'import' as Tab, label: I18n.t('Import')}] : []),
    ...(config.can_scan && config.can_see_all
      ? [{id: 'scan' as Tab, label: I18n.t('Scan an IEP')}]
      : []),
  ]

  return (
    <div
      style={{
        fontFamily: ROBOTO,
        background: SURFACE,
        minHeight: '100%',
        paddingBottom: 'calc(48px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <header
        style={{
          background: ink(BRAND),
          color: '#fff',
          boxShadow: ELEVATION[4],
          borderRadius: '2px 2px 0 0',
        }}
      >
        <div style={{padding: `clamp(20px, 5vw, 32px) ${PAD} 0`}}>
          <h1
            style={{
              margin: '0 0 8px',
              fontFamily: ROBOTO,
              fontWeight: 300,
              fontSize: 'clamp(1.75rem, 0.75rem + 4vw, 3rem)',
              lineHeight: 1.05,
              color: '#fff',
            }}
          >
            {I18n.t('Supports')}
          </h1>
          <p style={{margin: '0 0 16px', fontSize: 'clamp(1rem, 4vw, 1.125rem)', opacity: 0.92}}>
            {I18n.t('504, IEP and English-learner plans, and the accommodations teachers see.')}
          </p>
        </div>
        <div
          role="tablist"
          aria-label={I18n.t('Supports sections')}
          style={{display: 'flex', overflowX: 'auto', padding: `0 ${PAD}`}}
        >
          {tabs.map(item => {
            const selected = tab === item.id && !studentId
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => go(item.id)}
                style={{
                  minHeight: TAP + 4,
                  padding: '0 16px',
                  border: 'none',
                  borderBottom: `3px solid ${selected ? '#fff' : 'transparent'}`,
                  background: 'transparent',
                  color: '#fff',
                  opacity: selected ? 1 : 0.8,
                  font: 'inherit',
                  fontWeight: 500,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </header>

      <main style={{padding: `clamp(12px, 3vw, 20px) ${GUTTER} 0`, maxWidth: '64rem'}}>
        {studentId ? (
          <StudentPlans
            studentId={studentId}
            onBack={() => go('caseload')}
            scanAccountId={config.can_scan ? config.scan_account_id : null}
          />
        ) : tab === 'catalog' ? (
          <CatalogPanel />
        ) : tab === 'import' && config.can_import ? (
          <ImportPanel accounts={config.import_accounts} />
        ) : tab === 'scan' && config.can_scan && config.scan_account_id ? (
          <ScanPanel accountId={config.scan_account_id} />
        ) : (
          <CaseloadPanel canSeeAll={config.can_see_all} onOpen={id => go('caseload', id)} />
        )}
      </main>
    </div>
  )
}
