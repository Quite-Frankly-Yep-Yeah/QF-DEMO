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

import React from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {INK, ROBOTO} from '@canvas/material'
import {useMaterialPage} from '@canvas/material/useMaterialPage'
import {OnboardingChecklist} from '@canvas/onboarding-checklist'

const I18n = createI18nScope('install_status')

const GUIDE_URL = 'https://github.com/Quite-Frankly-Yep-Yeah/QF-DEMO/blob/main/docs/install.md'

export default function InstallStatusApp({track}: {track: string}) {
  useMaterialPage()

  return (
    <main style={{maxWidth: 760, margin: '0 auto', padding: '16px', fontFamily: ROBOTO}}>
      <h1 style={{fontWeight: 400, fontSize: '1.75rem', margin: '0 0 8px', color: INK.primary}}>
        {I18n.t('Finish installing')}
      </h1>
      <p style={{margin: '0 0 16px', color: INK.secondary}}>
        {I18n.t('Steps marked Detected are checked by the site each time this page loads.')}{' '}
        <a href={GUIDE_URL}>{I18n.t('Read the install guide')}</a>
      </p>
      <OnboardingChecklist track={track} />
    </main>
  )
}
