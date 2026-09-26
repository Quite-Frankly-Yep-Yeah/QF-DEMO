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
import {Button, IconButton} from '@instructure/ui-buttons'
import {IconMoreLine} from '@instructure/ui-icons'
import {Menu} from '@instructure/ui-menu'
import {Modal} from '@instructure/ui-modal'
import {Spinner} from '@instructure/ui-spinner'
import {Text} from '@instructure/ui-text'

const I18n = createI18nScope('self_paced_parent_invite')

type Invite = {code: string; url: string; expires_at: string; qr_svg: string}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`)

// A page to print: the QR code, what it is for, and the link for anyone who
// can't scan it.
export function printableInvite(studentName: string, invite: Invite): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    I18n.t('Parent sign-up'),
  )}</title><style>body{font-family:sans-serif;text-align:center;padding:48px}svg{width:320px;height:320px}p{font-size:18px}code{font-size:16px}</style></head><body><h1>${escapeHtml(
    I18n.t("Follow %{name}'s progress", {name: studentName}),
  )}</h1><p>${escapeHtml(I18n.t('Scan this code with your phone to make your account.'))}</p>${
    invite.qr_svg
  }<p>${escapeHtml(I18n.t('Or open this address:'))}<br><code>${escapeHtml(
    invite.url,
  )}</code></p><p>${escapeHtml(
    I18n.t('This code can be used once and expires on %{date}.', {
      date: new Date(invite.expires_at).toLocaleDateString(),
    }),
  )}</p></body></html>`
}

// The dialog: makes a fresh invitation when opened, shows its QR code and link,
// and lets staff copy, print or make another.
export function ParentInviteDialog({
  studentId,
  studentName,
  open,
  onClose,
}: {
  studentId: string
  studentName: string
  open: boolean
  onClose: () => void
}) {
  const [invite, setInvite] = useState<Invite | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const make = useCallback(async () => {
    setInvite(null)
    setError('')
    setCopied(false)
    try {
      const {json} = await doFetchApi<Invite>({
        path: `/api/v1/self_paced/students/${studentId}/parent_invite`,
        method: 'POST',
      })
      setInvite(json ?? null)
    } catch {
      setError(
        I18n.t(
          "Couldn't make a sign-up code. Only students in a class you can see can be invited, and the parent view has to be on.",
        ),
      )
    }
  }, [studentId])

  useEffect(() => {
    if (open) make()
  }, [open, make])

  const copy = async () => {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(invite.url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const print = () => {
    if (!invite) return
    const blob = new Blob([printableInvite(studentName, invite)], {type: 'text/html'})
    const page = window.open(URL.createObjectURL(blob), '_blank')
    page?.addEventListener('load', () => page.print())
  }

  return (
    <Modal
      open={open}
      onDismiss={onClose}
      size="small"
      label={I18n.t('Invite a parent of %{name}', {name: studentName})}
      shouldCloseOnDocumentClick={true}
    >
      <Modal.Header>
        <Text size="large" weight="light">
          {I18n.t('Invite a parent of %{name}', {name: studentName})}
        </Text>
      </Modal.Header>
      <Modal.Body>
        {error && <div role="alert">{error}</div>}
        {!error && !invite && <Spinner renderTitle={I18n.t('Making a code')} size="small" />}
        {invite && (
          <div style={{textAlign: 'center'}}>
            <p style={{margin: '0 0 12px'}}>
              {I18n.t('A parent scans this with their phone to make their account.')}
            </p>
            <div
              data-testid="parent-invite-qr"
              style={{width: 240, height: 240, margin: '0 auto'}}
              // the server draws this SVG from a link it built itself
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{__html: invite.qr_svg}}
            />
            <p style={{margin: '12px 0 4px', overflowWrap: 'anywhere'}}>
              <a href={invite.url}>{invite.url}</a>
            </p>
            <Text size="small" color="secondary">
              {I18n.t('One use. Expires on %{date}.', {
                date: new Date(invite.expires_at).toLocaleDateString(),
              })}
            </Text>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={make} margin="0 x-small 0 0">
          {I18n.t('New code')}
        </Button>
        <Button onClick={copy} disabled={!invite} margin="0 x-small 0 0">
          {copied ? I18n.t('Copied') : I18n.t('Copy link')}
        </Button>
        <Button onClick={print} disabled={!invite} margin="0 x-small 0 0">
          {I18n.t('Print')}
        </Button>
        <Button color="primary" onClick={onClose}>
          {I18n.t('Done')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

// A three-dot menu for one student with a single action for now: make a
// sign-up code for their parents.
export default function ParentInviteMenu({
  studentId,
  studentName,
}: {
  studentId: string
  studentName: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Menu
        placement="bottom end"
        trigger={
          <IconButton
            size="small"
            withBackground={false}
            withBorder={false}
            renderIcon={<IconMoreLine />}
            screenReaderLabel={I18n.t('More options for %{name}', {name: studentName})}
          />
        }
      >
        <Menu.Item onSelect={() => setOpen(true)}>{I18n.t('Invite a parent (QR code)')}</Menu.Item>
      </Menu>
      {open && (
        <ParentInviteDialog
          studentId={studentId}
          studentName={studentName}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
