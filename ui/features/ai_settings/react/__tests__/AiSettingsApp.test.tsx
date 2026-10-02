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
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import AiSettingsApp from '../AiSettingsApp'
import type {AiSettingsConfig, SettingsResponse} from '../types'

const config = (overrides: Partial<AiSettingsConfig> = {}): AiSettingsConfig => ({
  account_id: '1',
  is_site_admin_account: false,
  can_manage_school: true,
  can_manage_site: false,
  models: [
    {value: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable)'},
    {value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster, lower cost)'},
  ],
  default_model: 'claude-opus-5-5',
  ...overrides,
})

const saved = {
  has_key: true,
  key_last4: '4f2a',
  model: 'claude-opus-5-5',
  updated_at: '2026-10-02T12:00:00Z',
  updated_by: {id: '9', name: 'Casey Admin'},
}

const settings = (overrides: Partial<SettingsResponse> = {}): SettingsResponse => ({
  account: null,
  site: null,
  policy: {allow_account_keys: true},
  in_effect: {source: null, model: null, account_key_ignored: false},
  ...overrides,
})

let current: SettingsResponse
let sent: {method: string; path: string; body: Record<string, unknown>}[] = []
const note = async (request: Request) => {
  const text = await request.text()
  sent.push({
    method: request.method,
    path: new URL(request.url).pathname,
    body: text ? JSON.parse(text) : {},
  })
}

const server = setupServer(
  http.get('/api/v1/accounts/1/ai_settings', () => HttpResponse.json(current)),
  http.put('/api/v1/accounts/1/ai_settings', async ({request}) => {
    await note(request)
    return HttpResponse.json(current)
  }),
  http.delete('/api/v1/accounts/1/ai_settings', async ({request}) => {
    await note(request)
    return HttpResponse.json(settings())
  }),
  http.put('/api/v1/accounts/1/ai_settings/site', async ({request}) => {
    await note(request)
    return HttpResponse.json(current)
  }),
  http.post('/api/v1/accounts/1/ai_settings/test', async ({request}) => {
    await note(request)
    return HttpResponse.json({ok: true, message: 'It works.'})
  }),
)

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  sent = []
  vi.restoreAllMocks()
})
afterAll(() => server.close())

describe('AiSettingsApp', () => {
  it('asks for a key when there is none, and sends what was typed, then clears the field', async () => {
    current = settings()
    render(<AiSettingsApp config={config()} />)
    const field = await screen.findByLabelText('API key')
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveAttribute('autocomplete', 'off')
    expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled()

    await userEvent.type(field, 'sk-ant-new-key')
    await userEvent.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() =>
      expect(sent[0]?.body).toEqual({api_key: 'sk-ant-new-key', model: 'claude-opus-5-5'}),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
    expect(screen.getByLabelText('API key')).toHaveValue('')
  })

  it('shows only the last four of a saved key, with no field holding the key', async () => {
    current = settings({account: saved})
    render(<AiSettingsApp config={config()} />)
    expect(await screen.findByText('Key ending 4f2a')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Replace'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Remove'})).toBeInTheDocument()
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument()
  })

  it('sends only what changed: a new key without the model, or a new model without the key', async () => {
    current = settings({account: saved})
    render(<AiSettingsApp config={config()} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Replace'}))
    await userEvent.type(screen.getByLabelText('API key'), 'sk-ant-replacement')
    await userEvent.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() => expect(sent[0]?.body).toEqual({api_key: 'sk-ant-replacement'}))
    // focus goes back to Replace after saving
    await waitFor(() => expect(screen.getByRole('button', {name: 'Replace'})).toHaveFocus())

    await userEvent.selectOptions(screen.getByLabelText('Model'), 'claude-sonnet-5-5')
    await userEvent.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() => expect(sent[1]?.body).toEqual({model: 'claude-sonnet-5-5'}))
  })

  it('removes the key only after confirming', async () => {
    current = settings({account: saved})
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<AiSettingsApp config={config()} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Remove'}))
    expect(sent).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', {name: 'Remove'}))
    await waitFor(() => expect(sent[0]).toMatchObject({method: 'DELETE'}))
    expect(await screen.findByRole('status')).toHaveTextContent('Key removed.')
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(await screen.findByLabelText('API key')).toBeInTheDocument()
  })

  it.each([
    ['account', "This school's key is in use."],
    ['site', "The site's shared key is in use."],
    ['file', "The server's configuration is in use."],
    [null, 'No key is set up, so IEP scanning is off.'],
  ] as const)('says which key is in effect: %s', async (source, text) => {
    current = settings({in_effect: {source, model: 'claude-opus-5-5', account_key_ignored: false}})
    render(<AiSettingsApp config={config()} />)
    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('says when the school has a key the site is not letting it use', async () => {
    current = settings({
      account: saved,
      policy: {allow_account_keys: false},
      in_effect: {source: 'site', model: 'claude-opus-5-5', account_key_ignored: true},
    })
    render(<AiSettingsApp config={config()} />)
    expect(await screen.findByText(/the site doesn't allow school keys/)).toBeInTheDocument()
  })

  it('shows the site section only to site admins, and only the site section on the site account', async () => {
    current = settings()
    const {unmount} = render(<AiSettingsApp config={config()} />)
    await screen.findByLabelText('API key')
    expect(screen.queryByRole('heading', {name: 'Site-wide key'})).not.toBeInTheDocument()
    unmount()

    render(<AiSettingsApp config={config({can_manage_site: true})} />)
    expect(await screen.findByRole('heading', {name: 'Site-wide key'})).toBeInTheDocument()
    expect(screen.getByRole('heading', {name: "This school's key"})).toBeInTheDocument()
  })

  it('has no school section on the site admin account', async () => {
    current = settings()
    render(
      <AiSettingsApp
        config={config({
          is_site_admin_account: true,
          can_manage_school: false,
          can_manage_site: true,
        })}
      />,
    )
    expect(await screen.findByRole('heading', {name: 'Site-wide key'})).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: "This school's key"})).not.toBeInTheDocument()
  })

  it('turns whether schools may use their own key on and off', async () => {
    current = settings({site: {...saved, allow_account_keys: true}})
    render(<AiSettingsApp config={config({can_manage_site: true})} />)
    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Let schools use their own key'}),
    )
    await waitFor(() =>
      expect(sent.find(r => r.path.endsWith('/site'))?.body).toEqual({allow_account_keys: false}),
    )
  })

  it('tests the connection and says what happened', async () => {
    current = settings({account: saved})
    render(<AiSettingsApp config={config()} />)
    await userEvent.click(await screen.findByRole('button', {name: 'Test connection'}))
    expect(await screen.findByRole('status')).toHaveTextContent('It works.')
    expect(sent[0]).toMatchObject({
      path: '/api/v1/accounts/1/ai_settings/test',
      body: {scope: 'account'},
    })

    server.use(
      http.post('/api/v1/accounts/1/ai_settings/test', () =>
        HttpResponse.json({ok: false, message: 'The key was rejected.'}),
      ),
    )
    await userEvent.click(screen.getByRole('button', {name: 'Test connection'}))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('The key was rejected.'),
    )
  })

  it('tests a key that was typed but not saved', async () => {
    current = settings()
    render(<AiSettingsApp config={config()} />)
    await userEvent.type(await screen.findByLabelText('API key'), 'sk-ant-typed')
    await userEvent.click(screen.getByRole('button', {name: 'Test connection'}))
    await waitFor(() =>
      expect(sent[0]?.body).toMatchObject({scope: 'account', api_key: 'sk-ant-typed'}),
    )
  })

  it("shows the server's message when a save fails", async () => {
    current = settings()
    server.use(
      http.put('/api/v1/accounts/1/ai_settings', () =>
        HttpResponse.json({errors: ['Model is not included in the list']}, {status: 422}),
      ),
    )
    render(<AiSettingsApp config={config()} />)
    await userEvent.type(await screen.findByLabelText('API key'), 'k')
    await userEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await screen.findByRole('status')).toHaveTextContent('Model is not included in the list')
  })

  it('can be used from the keyboard', async () => {
    current = settings()
    render(<AiSettingsApp config={config()} />)
    await screen.findByLabelText('API key')
    await userEvent.tab()
    expect(screen.getByLabelText('API key')).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByLabelText('Model')).toHaveFocus()
  })
  it("hides the school section from someone who can't save it, even a site admin", async () => {
    current = settings()
    render(<AiSettingsApp config={config({can_manage_school: false, can_manage_site: true})} />)
    expect(await screen.findByRole('heading', {name: 'Site-wide key'})).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: "This school's key"})).not.toBeInTheDocument()
  })
})
