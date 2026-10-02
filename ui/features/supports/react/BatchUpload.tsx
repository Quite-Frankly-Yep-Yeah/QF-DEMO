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

import React, {useMemo, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import doFetchApi from '@canvas/do-fetch-api-effect'
import type {ScanBatch} from './types'
import {button, field, Label, messageFrom, muted, Status} from './ui'

const I18n = createI18nScope('supports')

const MB = 1024 * 1024
export const MAX_FILES = 25
export const MAX_FILE_BYTES = 20 * MB
export const MAX_IMAGE_BYTES = 5 * MB
export const MAX_TOTAL_BYTES = 200 * MB

const isImage = (file: File) =>
  /^image\/(png|jpeg)$/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name)
const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

// Why these files can't be sent, naming the file, or '' when they can.
export function filesProblem(files: File[]): string {
  if (files.length > MAX_FILES) {
    return I18n.t('Choose at most %{count} files at a time.', {count: MAX_FILES})
  }
  for (const file of files) {
    if (!isPdf(file) && !isImage(file)) {
      return I18n.t('%{name} is not a PDF, PNG or JPEG file.', {name: file.name})
    }
    if (isImage(file) && file.size > MAX_IMAGE_BYTES) {
      return I18n.t('%{name} is larger than 5 MB.', {name: file.name})
    }
    if (file.size > MAX_FILE_BYTES) {
      return I18n.t('%{name} is larger than 20 MB.', {name: file.name})
    }
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
    return I18n.t('The files add up to more than 200 MB.')
  }
  return ''
}

// Stage 1 of a batch: pick up to 25 IEPs and send them to be read.
export default function BatchUpload({
  accountId,
  onStarted,
}: {
  accountId: string
  onStarted: (batch: ScanBatch) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = useMemo(() => filesProblem(files), [files])

  const upload = async () => {
    if (!files.length || problem) return
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      files.forEach(file => body.append('files[]', file))
      body.append('account_id', accountId)
      const {json} = await doFetchApi<ScanBatch>({
        path: '/api/v1/supports/scan_batches',
        method: 'POST',
        body,
      })
      if (json) onStarted(json)
    } catch (e) {
      setError(await messageFrom(e))
    } finally {
      setBusy(false)
    }
  }

  const chosen =
    files.length === 0
      ? ''
      : files.length === 1
        ? I18n.t('1 file chosen.')
        : I18n.t('%{count} files chosen.', {count: files.length})
  const off = !files.length || !!problem || busy

  return (
    <div>
      <p style={{...muted, margin: '0 0 12px'}}>
        {I18n.t(
          'Upload up to 25 IEPs as PDFs or images. Each is read and matched to a student. You confirm the matches, then check each one before anything is saved.',
        )}
      </p>
      <Label text={I18n.t('IEP files')}>
        <input
          style={field}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          onChange={event => {
            setFiles(Array.from(event.target.files ?? []))
            setError('')
          }}
        />
      </Label>
      <button
        type="button"
        style={{...button, opacity: off ? 0.5 : 1}}
        disabled={off}
        onClick={upload}
      >
        {I18n.t('Upload')}
      </button>
      <Status message={error || problem || chosen} />
    </div>
  )
}
