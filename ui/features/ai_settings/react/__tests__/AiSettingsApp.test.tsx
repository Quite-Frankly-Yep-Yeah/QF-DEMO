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
import {render, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import AiSettingsApp from '../AiSettingsApp'
import type {AiSettingsConfig, FeatureInfo, SettingsResponse} from '../types'

const models = [
  {
    value: 'claude-opus-5-5',
    label: 'Claude Opus 5.5',
    summary: 'Most capable.',
    use_when: 'Complex, long or ambiguous work.',
    input_price: 4,
    output_price: 20,
    context_tokens: 1_000_000,
    supports_effort: true,
    cost_vs_cheapest: 4,
  },
  {
    value: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    summary: 'Balanced.',
    use_when: 'A good default for most everyday work.',
    input_price: 2,
    output_price: 10,
    context_tokens: 1_000_000,
    supports_effort: true,
    cost_vs_cheapest: 2,
  },
  {
    value: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    summary: 'Fastest and cheapest.',
    use_when: 'Simple, short or high-volume work.',
    input_price: 1,
    output_price: 5,
    context_tokens: 200_000,
    supports_effort: false,
    cost_vs_cheapest: 1,
  },
]

const iepScan: FeatureInfo = {key: 'iep_scan', label: 'IEP scan', recommended: null, why: null}

const config = (overrides: Partial<AiSettingsConfig> = {}): AiSettingsConfig => ({
  account_id: '1',
  is_site_admin_account: false,
  can_manage_school: true,
  can_manage_site: false,
  models,
  prices_checked: '2026-09-25',
  default_model: 'claude-opus-5-5',
  features: [iepScan],
  ...overrides,
})

const saved = {
  has_key: true,
  key_last4: '4f2a',
  model: null,
  feature_models: {},
  updated_at: '2026-10-02T12:00:00Z',
  updated_by: {id: '9', name: 'Casey Admin'},
}

const noEffect = {
  source: null,
  model: null,
  model_source: null,
  account_key_ignored: false,
  school_models_ignored: false,
  features: [],
}

const settings = (overrides: Partial<SettingsResponse> = {}): SettingsResponse => ({
  account: null,
  site: null,
  policy: {allow_account_keys: true, allow_account_models: true},
  features: [iepScan],
  in_effect: noEffect,
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

const card = (name: string) => within(screen.getByRole('region', {name}))
const renderApp = async (c: AiSettingsConfig = config()) => {
  render(<AiSettingsApp config={c} />)
  await screen.findByTestId('ai-settings-grid')
}

describe('the model guide', () => {
  it('shows the three models, what each is for and what it costs', async () => {
    current = settings()
    await renderApp()
    const guide = within(screen.getByRole('region', {name: 'Models at a glance'}))
    expect(guide.getAllByRole('heading', {level: 3}).map(h => h.textContent)).toEqual([
      'Claude Opus 5.5',
      'Claude Sonnet 5.5',
      'Claude Haiku 4.5',
    ])
    expect(guide.getByText('$4 in / $20 out per 1M tokens')).toBeInTheDocument()
    expect(guide.getByText('$1 in / $5 out per 1M tokens')).toBeInTheDocument()
    expect(guide.getByText('4× the cost of Haiku')).toBeInTheDocument()
    expect(guide.getByText('2× the cost of Haiku')).toBeInTheDocument()
    expect(guide.getByText('Lowest price')).toBeInTheDocument()
    expect(guide.getByText('Complex, long or ambiguous work.')).toBeInTheDocument()
    expect(guide.getAllByText('1M tokens of context')).toHaveLength(2)
    expect(guide.getByText('200K tokens of context')).toBeInTheDocument()
    expect(guide.getByText('No effort setting')).toBeInTheDocument()
    expect(screen.getByText(/List prices.*2026-09-25/)).toBeInTheDocument()
  })

  it('is about AI work in general, not about any one feature', async () => {
    current = settings()
    await renderApp()
    expect(screen.getByRole('region', {name: 'Models at a glance'}).textContent).not.toMatch(/IEP/)
  })

  it('marks the model each feature is using', async () => {
    current = settings({
      account: saved,
      in_effect: {
        ...noEffect,
        source: 'account',
        model: 'claude-opus-5-5',
        features: [
          {
            feature: 'iep_scan',
            label: 'IEP scan',
            model: 'claude-sonnet-5-5',
            model_source: 'account_feature',
          },
        ],
      },
    })
    await renderApp()
    const guide = within(screen.getByRole('region', {name: 'Models at a glance'}))
    expect(
      within(guide.getByRole('article', {name: 'Claude Sonnet 5.5'})).getByText('In use: IEP scan'),
    ).toBeInTheDocument()
    expect(
      within(guide.getByRole('article', {name: 'Claude Haiku 4.5'})).queryByText(/In use/),
    ).not.toBeInTheDocument()
  })
})

describe('the dashboard', () => {
  it('lays its cards out in a grid that fills the width and stacks on a phone', async () => {
    current = settings()
    await renderApp()
    const grid = screen.getByTestId('ai-settings-grid')
    expect(grid.style.gridTemplateColumns).toContain('auto-fit')
    expect(grid.style.maxWidth).toBe('')
  })

  it.each([
    ['account', "This school's key is in use."],
    ['site', "The site's shared key is in use."],
    ['file', "The server's configuration is in use."],
    [null, 'No key is set up, so IEP scanning is off.'],
  ] as const)('says which key is in effect: %s', async (source, text) => {
    current = settings({in_effect: {...noEffect, source}})
    await renderApp()
    expect(card('In effect').getByText(text)).toBeInTheDocument()
  })

  it('says when the site is not letting the school use its own key or models', async () => {
    current = settings({
      account: saved,
      policy: {allow_account_keys: false, allow_account_models: false},
      in_effect: {
        ...noEffect,
        source: 'site',
        account_key_ignored: true,
        school_models_ignored: true,
      },
    })
    await renderApp()
    expect(card('In effect').getByText(/the site doesn't allow school keys/)).toBeInTheDocument()
    expect(
      card('In effect').getByText(/site doesn't let schools choose models/),
    ).toBeInTheDocument()
  })

  it('shows the site cards only to site admins, and only those on the site account', async () => {
    current = settings()
    await renderApp()
    expect(screen.queryByRole('region', {name: 'Site-wide key'})).not.toBeInTheDocument()
    expect(screen.queryByRole('region', {name: 'Site policies'})).not.toBeInTheDocument()
    expect(screen.getByRole('region', {name: "This school's key"})).toBeInTheDocument()
  })

  it('shows a site admin the site key and policies as well', async () => {
    current = settings()
    await renderApp(config({can_manage_site: true}))
    expect(screen.getByRole('region', {name: 'Site-wide key'})).toBeInTheDocument()
    expect(screen.getByRole('region', {name: 'Site policies'})).toBeInTheDocument()
    expect(screen.getByRole('region', {name: "This school's key"})).toBeInTheDocument()
  })

  it("has no school cards when the viewer can't manage the school", async () => {
    current = settings()
    await renderApp(
      config({is_site_admin_account: true, can_manage_school: false, can_manage_site: true}),
    )
    expect(screen.getByRole('region', {name: 'Site-wide key'})).toBeInTheDocument()
    expect(screen.queryByRole('region', {name: "This school's key"})).not.toBeInTheDocument()
    expect(screen.queryByLabelText('IEP scan, school')).not.toBeInTheDocument()
  })
})

describe('the key cards', () => {
  it('asks for a key when there is none, sends only what was typed, then clears the field', async () => {
    current = settings()
    await renderApp()
    const key = card("This school's key")
    const field = key.getByLabelText('API key')
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveAttribute('autocomplete', 'off')
    expect(key.getByRole('button', {name: 'Save key'})).toBeDisabled()

    await userEvent.type(field, 'sk-ant-new-key')
    await userEvent.click(key.getByRole('button', {name: 'Save key'}))
    await waitFor(() => expect(sent[0]?.body).toEqual({api_key: 'sk-ant-new-key'}))
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
    expect(card("This school's key").getByLabelText('API key')).toHaveValue('')
  })

  it('shows only the last four of a saved key, with no field holding the key', async () => {
    current = settings({account: saved})
    await renderApp()
    const key = card("This school's key")
    expect(key.getByText('Key ending 4f2a')).toBeInTheDocument()
    expect(key.getByRole('button', {name: 'Replace'})).toBeInTheDocument()
    expect(key.getByRole('button', {name: 'Remove'})).toBeInTheDocument()
    expect(key.queryByLabelText('API key')).not.toBeInTheDocument()
  })

  it('replaces a key, and puts focus back on Replace afterwards', async () => {
    current = settings({account: saved})
    await renderApp()
    await userEvent.click(card("This school's key").getByRole('button', {name: 'Replace'}))
    await userEvent.type(card("This school's key").getByLabelText('API key'), 'sk-ant-replacement')
    await userEvent.click(card("This school's key").getByRole('button', {name: 'Save key'}))
    await waitFor(() => expect(sent[0]?.body).toEqual({api_key: 'sk-ant-replacement'}))
    await waitFor(() =>
      expect(card("This school's key").getByRole('button', {name: 'Replace'})).toHaveFocus(),
    )
  })

  it('removes the key only after confirming', async () => {
    current = settings({account: saved})
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await renderApp()
    await userEvent.click(card("This school's key").getByRole('button', {name: 'Remove'}))
    expect(sent).toHaveLength(0)
    await userEvent.click(card("This school's key").getByRole('button', {name: 'Remove'}))
    await waitFor(() => expect(sent[0]).toMatchObject({method: 'DELETE'}))
    expect(await screen.findByRole('status')).toHaveTextContent('Key removed.')
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(await card("This school's key").findByLabelText('API key')).toBeInTheDocument()
  })

  it('tests the saved key, and a key that was typed but not saved', async () => {
    current = settings({account: saved})
    await renderApp()
    await userEvent.click(card("This school's key").getByRole('button', {name: 'Test connection'}))
    expect(await screen.findByRole('status')).toHaveTextContent('It works.')
    expect(sent[0]).toMatchObject({
      path: '/api/v1/accounts/1/ai_settings/test',
      body: {scope: 'account'},
    })

    server.use(
      http.post('/api/v1/accounts/1/ai_settings/test', async ({request}) => {
        await note(request)
        return HttpResponse.json({ok: false, message: 'The key was rejected.'})
      }),
    )
    await userEvent.click(card("This school's key").getByRole('button', {name: 'Replace'}))
    await userEvent.type(card("This school's key").getByLabelText('API key'), 'sk-ant-typed')
    await userEvent.click(card("This school's key").getByRole('button', {name: 'Test connection'}))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('The key was rejected.'),
    )
    expect(sent[1]?.body).toMatchObject({scope: 'account', api_key: 'sk-ant-typed'})
  })

  it("shows the server's message when a save fails", async () => {
    current = settings()
    server.use(
      http.put('/api/v1/accounts/1/ai_settings', () =>
        HttpResponse.json({errors: ['The key is too short.']}, {status: 422}),
      ),
    )
    await renderApp()
    await userEvent.type(card("This school's key").getByLabelText('API key'), 'k')
    await userEvent.click(card("This school's key").getByRole('button', {name: 'Save key'}))
    expect(await screen.findByRole('status')).toHaveTextContent('The key is too short.')
  })

  it('saves the site key to the site endpoint', async () => {
    current = settings()
    await renderApp(config({can_manage_site: true}))
    await userEvent.type(card('Site-wide key').getByLabelText('API key'), 'sk-ant-site-key')
    await userEvent.click(card('Site-wide key').getByRole('button', {name: 'Save key'}))
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        path: '/api/v1/accounts/1/ai_settings/site',
        body: {api_key: 'sk-ant-site-key'},
      }),
    )
  })
})

describe('the site policies', () => {
  it('turns whether schools may use their own key on and off', async () => {
    current = settings({site: {...saved, allow_account_keys: true, allow_account_models: true}})
    await renderApp(config({can_manage_site: true}))
    await userEvent.click(
      card('Site policies').getByRole('checkbox', {name: 'Let schools use their own key'}),
    )
    await waitFor(() => expect(sent[0]?.body).toEqual({allow_account_keys: false}))
  })

  it('turns whether schools may choose models on the shared key on and off', async () => {
    current = settings({site: {...saved, allow_account_keys: true, allow_account_models: true}})
    await renderApp(config({can_manage_site: true}))
    await userEvent.click(
      card('Site policies').getByRole('checkbox', {
        name: 'Let schools choose models when they use the shared key',
      }),
    )
    await waitFor(() => expect(sent[0]?.body).toEqual({allow_account_models: false}))
  })
})

describe('the model cards', () => {
  it('has a card for the default model and one for each feature', async () => {
    current = settings()
    await renderApp()
    expect(screen.getByRole('region', {name: 'Default model'})).toBeInTheDocument()
    expect(screen.getByRole('region', {name: 'IEP scan'})).toBeInTheDocument()
  })

  it('sets the school default model and saves it from its own card', async () => {
    current = settings({account: saved})
    await renderApp()
    const model = card('Default model')
    expect(model.getByLabelText('Default model, school')).toHaveValue('')
    expect(model.getByRole('option', {name: "Use the site's default"})).toBeInTheDocument()
    expect(model.getByRole('button', {name: 'Save Default model, school'})).toBeDisabled()

    await userEvent.selectOptions(
      model.getByLabelText('Default model, school'),
      'claude-sonnet-5-5',
    )
    await userEvent.click(model.getByRole('button', {name: 'Save Default model, school'}))
    await waitFor(() => expect(sent[0]?.body).toEqual({model: 'claude-sonnet-5-5'}))
  })

  it('sets a model for one feature, and clears it with "Use the default model"', async () => {
    current = settings({account: {...saved, feature_models: {iep_scan: 'claude-sonnet-5-5'}}})
    await renderApp()
    const feature = card('IEP scan')
    const select = feature.getByLabelText('IEP scan, school')
    await waitFor(() => expect(select).toHaveValue('claude-sonnet-5-5'))
    expect(feature.getByRole('option', {name: 'Use the default model'})).toBeInTheDocument()

    await userEvent.selectOptions(select, '')
    await userEvent.click(feature.getByRole('button', {name: 'Save IEP scan, school'}))
    await waitFor(() => expect(sent[0]?.body).toEqual({models: {iep_scan: ''}}))
  })

  it('saves a feature model for the site from the site picker', async () => {
    current = settings({
      account: saved,
      site: {...saved, allow_account_keys: true, allow_account_models: true},
    })
    await renderApp(config({can_manage_site: true}))
    const feature = card('IEP scan')
    await userEvent.selectOptions(feature.getByLabelText('IEP scan, site'), 'claude-haiku-4-5')
    await userEvent.click(feature.getByRole('button', {name: 'Save IEP scan, site'}))
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        path: '/api/v1/accounts/1/ai_settings/site',
        body: {models: {iep_scan: 'claude-haiku-4-5'}},
      }),
    )
  })

  it('says which model is in use for the feature, and why', async () => {
    current = settings({
      account: saved,
      in_effect: {
        ...noEffect,
        source: 'account',
        model: 'claude-opus-5-5',
        model_source: 'default',
        features: [
          {
            feature: 'iep_scan',
            label: 'IEP scan',
            model: 'claude-sonnet-5-5',
            model_source: 'account_feature',
          },
        ],
      },
    })
    await renderApp()
    expect(
      card('IEP scan').getByText(
        "In use: Claude Sonnet 5.5 (the school's choice for this feature)",
      ),
    ).toBeInTheDocument()
    expect(
      card('Default model').getByText("In use: Claude Opus 5.5 (the app's default)"),
    ).toBeInTheDocument()
  })

  it('shows a stored model that is no longer offered, so it can be seen and cleared', async () => {
    current = settings({account: {...saved, feature_models: {iep_scan: 'claude-old-1'}}})
    await renderApp()
    const feature = card('IEP scan')
    await waitFor(() =>
      expect(feature.getByLabelText('IEP scan, school')).toHaveValue('claude-old-1'),
    )
    expect(
      feature.getByRole('option', {name: 'claude-old-1 (no longer offered)'}),
    ).toBeInTheDocument()
  })

  it('says so when no model has been recommended for a feature', async () => {
    current = settings()
    await renderApp()
    expect(card('IEP scan').getByText('No recommendation yet')).toBeInTheDocument()
  })

  it('shows the recommended model, and fills the picker with it without saving', async () => {
    const recommended = {
      ...iepScan,
      recommended: 'claude-sonnet-5-5',
      why: 'accurate on long, typed documents',
    }
    current = settings({account: saved, features: [recommended]})
    await renderApp(config({features: [recommended]}))
    const feature = card('IEP scan')
    expect(feature.getByText('Recommended: Claude Sonnet 5.5')).toBeInTheDocument()
    expect(feature.getByText('accurate on long, typed documents')).toBeInTheDocument()

    await userEvent.click(
      feature.getByRole('button', {name: 'Use recommended for IEP scan, school'}),
    )
    expect(feature.getByLabelText('IEP scan, school')).toHaveValue('claude-sonnet-5-5')
    expect(sent).toHaveLength(0)
    await userEvent.click(feature.getByRole('button', {name: 'Save IEP scan, school'}))
    await waitFor(() => expect(sent[0]?.body).toEqual({models: {iep_scan: 'claude-sonnet-5-5'}}))
  })

  it('has no recommendation slot on the default model card', async () => {
    current = settings()
    await renderApp()
    expect(card('Default model').queryByText('No recommendation yet')).not.toBeInTheDocument()
  })
})
