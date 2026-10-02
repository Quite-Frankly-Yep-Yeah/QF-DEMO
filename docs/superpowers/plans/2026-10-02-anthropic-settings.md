# Anthropic Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins supply and manage the Anthropic API key and model from the admin area, per school or site-wide, with the site deciding whether schools may bring their own.

**Architecture:** One encrypted-key table (`Supports::AnthropicSetting`, one row per root account plus one site row) resolved by `Supports::AnthropicConfig.for(root_account)`, which `IepExtractor` uses instead of reading `anthropic.yml` directly (the file stays as the last fallback). A JSON API plus a new React page, reached from an account navigation tab that the admin hub already turns into a link.

**Tech Stack:** Rails, Active Record `encrypts`, RSpec, `anthropic` gem, React + TypeScript + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-anthropic-settings-design.md`

## Global Constraints

- Models offered, exactly: `claude-opus-5-5` (default), `claude-sonnet-5-5`, `claude-haiku-4-5`.
- The key is encrypted at rest, write-only through the API, and never in a response, log line, error report or error message. Only the last four characters are stored in the clear (`key_last4`). `api_key` is a filtered parameter.
- Order of use: school key (if the site row doesn't set `allow_account_keys` to false) → site key → `anthropic.yml` → none.
- Permissions: school actions need `:manage_account_settings` on the root account; site actions need `:manage_site_settings` on `Account.site_admin`. A non-root account gets 404.
- An empty `api_key` on save means "leave the key as it is". Removing a key is `DELETE`.
- Test connection sends one small request and returns only fixed messages ("It works", "The key was rejected", "The service couldn't be reached"), never the provider's text.
- `HubApp.tsx` is not touched (it has uncommitted work). The hub gets the entry through an account tab and `hubModel.ts`.
- UI is Material 1 in the hub's look (Roboto, the committed `self_paced_home` material tokens: `ROBOTO`, `SURFACE`, `INK`, `ELEVATION`, `ink`), text contrast at least 4.5:1, keyboard operable, status changes announced; strings via `I18n.t`.
- Commits follow `AGENTS.md` (lines under 60 characters, why not what, `flag=none`, test plan, git-hook ChangeId untouched) plus the session's `Co-Authored-By` trailer. Git has no identity configured here: set `GIT_AUTHOR_NAME=niko GIT_AUTHOR_EMAIL=cbabushka58@gmail.com GIT_COMMITTER_NAME=niko GIT_COMMITTER_EMAIL=cbabushka58@gmail.com` per command, and commit only your own paths with `git commit -- <paths>` (the working tree holds unrelated staged and uncommitted changes).
- Ruby, yarn and rake commands run in the container: `docker compose run --rm web …`. Never run `rubocop -a` on a file that already has offenses you didn't cause (it rewrites unrelated lines).

## Review Focus

1. A key (or part of one) leaking through an error: a 422 echoing params, the test endpoint's provider error, an exception message, the log. (Task 3)
2. Saving with a blank or whitespace-only `api_key`, or one pasted with surrounding spaces or a newline: the old key stays, or the new one is trimmed. (Task 3)
3. Site policy turned off while a school has a key, then turned back on: the school key is ignored, then used again, with nothing lost. (Tasks 1, 3)
4. The wrong person or place: a teacher, a sub-account admin, a sub-account id, a school admin hitting the site endpoints. (Task 3)
5. Test connection hammered: it spends money and calls the provider each time. (Task 3: a per-user limit.)

---

## File Structure

| File | Responsibility |
|---|---|
| `db/migrate/20261002100000_create_anthropic_settings.rb` (new) | the table |
| `app/models/supports/anthropic_setting.rb` (new) | encrypted key, last four, model, validations |
| `app/services/supports/anthropic_config.rb` (new) | which key and model are in effect |
| `app/services/supports/anthropic_connection_test.rb` (new) | the one-request check |
| `lib/logging_filter.rb` | add `api_key` to the filtered parameters |
| `app/services/supports/iep_extractor.rb` | use `AnthropicConfig` |
| `app/controllers/supports/anthropic_settings_controller.rb` (new), `config/routes.rb` | page and API |
| `app/models/account.rb` | the `ai_settings` navigation tab |
| `ui/features/admin_hub/react/hubModel.ts` | put the tab in "Access and security" |
| `ui/features/ai_settings/` (new: `index.tsx`, `package.json`, `react/AiSettingsApp.tsx`, `react/KeySection.tsx`, `react/types.ts`), `ui/featureBundles.ts` | the page |

---

### Task 1: Settings table and `AnthropicConfig`

**Files:**
- Create: `db/migrate/20261002100000_create_anthropic_settings.rb`, `app/models/supports/anthropic_setting.rb`, `app/services/supports/anthropic_config.rb`
- Modify: `lib/logging_filter.rb` (add `:api_key` to `FILTERED_PARAMETERS`)
- Test: `spec/models/supports/anthropic_setting_spec.rb`, `spec/services/supports/anthropic_config_spec.rb`

**Interfaces:**
- Produces:
  - `Supports::AnthropicSetting` (table `anthropic_settings`): `root_account` (optional; nil is the site row), `api_key` (encrypted), `key_last4`, `model`, `allow_account_keys` (bool, default true), `updated_by` (User, optional). `MODELS = %w[claude-opus-5-5 claude-sonnet-5-5 claude-haiku-4-5]`, `DEFAULT_MODEL = "claude-opus-5-5"`. `.site -> AnthropicSetting | nil`, `.for_account(root_account) -> AnthropicSetting | nil`, `#key?`, `#api_key=` also sets `key_last4` (nil clears both).
  - `Supports::AnthropicConfig.for(root_account) -> { api_key: String, model: String, source: :account | :site | :file } | nil`; `.explain(root_account) -> { source: Symbol | nil, model: String | nil, account_key_ignored: Boolean }` (for the page: what is in effect, and whether a school key exists but the site forbids it).

- [ ] **Step 1: Write failing specs.**
  - Model: a row saves; `api_key=` sets `key_last4` to the last four characters and the raw column doesn't contain the key; `api_key = nil` clears both; `model` outside `MODELS` is invalid; a second row for the same `root_account_id`, or a second site row, is rejected (also at the database: `create_or_find_by!` race).
  - Config, one example per rung: school key with policy on → `source: :account`; school key with site `allow_account_keys: false` → falls to the site key, and `explain` reports `account_key_ignored: true`; no school key → site key; neither → `anthropic.yml` (stub `DynamicSettings.find(tree: :private)["anthropic.yml"]` to YAML with `api_key`, `model`) → `source: :file`; nothing anywhere → `nil`; a stored model not in `MODELS` falls back to `DEFAULT_MODEL`; turning the policy back on makes the school key win again.
- [ ] **Step 2: Run** `docker compose run --rm web bin/rspec spec/models/supports/anthropic_setting_spec.rb spec/services/supports/anthropic_config_spec.rb`. Expected: FAIL (uninitialized constant).
- [ ] **Step 3: Migration** (`tag :predeploy`, `Migration[8.0]`, header and style of `20260930010000_create_accommodation_applications.rb`): table with `root_account` reference (nullable, FK to accounts, `index: false`), `api_key` text, `key_last4` string(4), `model` string(255) default `claude-opus-5-5` not null, `allow_account_keys` boolean default true not null, `updated_by` reference (nullable FK to users), timestamps; a unique index on `root_account_id` where not null, a unique index on `((root_account_id IS NULL))` where `root_account_id IS NULL` (one site row), and `t.replica_identity_index`. Then run `rake db:migrate` for development and test (`RAILS_ENV=test`).
- [ ] **Step 4: Model and config.** `encrypts :api_key`. `AnthropicConfig.for` follows the Global Constraints order; the `file` rung reads `YAML.safe_load(DynamicSettings.find(tree: :private)["anthropic.yml"] || "{}")`. Add `:api_key` to `FILTERED_PARAMETERS`.
- [ ] **Step 5: Run the specs and `bin/rubocop` on the new files.** Expected: PASS, no offenses.
- [ ] **Step 6: Commit** the new files plus `lib/logging_filter.rb`.

---

### Task 2: `IepExtractor` uses `AnthropicConfig`

**Files:**
- Modify: `app/services/supports/iep_extractor.rb`
- Test: `spec/services/supports/iep_extractor_spec.rb`

**Interfaces:**
- Consumes: `AnthropicConfig.for(root_account)` (Task 1).
- Produces: nothing new. The extractor no longer reads `anthropic.yml` itself.

- [ ] **Step 1: Write failing specs.** With no injected client: a school key and model from `AnthropicSetting` are what `Anthropic::Client.new` receives (stub `Anthropic::Client.new` and capture `api_key:`) and what `messages.create` gets as `model:`; with no configuration anywhere `call` raises `Failed` with "IEP scanning isn't set up for this school."; a fallback to `anthropic.yml` still works. The existing injected-client specs stay and must still pass.
- [ ] **Step 2: Run, expect FAIL** on the new examples.
- [ ] **Step 3: Replace `settings` and `client`** in `IepExtractor` with `AnthropicConfig.for(@root_account)` (memoized per call): `client` builds `Anthropic::Client.new(api_key: config[:api_key])`, `call` uses `config[:model]`. Remove the old `settings` method and the `MODEL` fallback use (keep the constant only if still referenced).
- [ ] **Step 4: Run** `bin/rspec spec/services/supports` and rubocop on the file. Expected: PASS.
- [ ] **Step 5: Commit.**

---

### Task 3: Settings API, connection test, routes

**Files:**
- Create: `app/controllers/supports/anthropic_settings_controller.rb`, `app/services/supports/anthropic_connection_test.rb`
- Modify: `config/routes.rb`
- Test: `spec/controllers/supports/anthropic_settings_controller_spec.rb`, `spec/services/supports/anthropic_connection_test_spec.rb`

**Interfaces:**
- Consumes: `AnthropicSetting`, `AnthropicConfig.explain` (Task 1).
- Produces:
  - `Supports::AnthropicConnectionTest.call(api_key:, model:, client: nil) -> { ok: Boolean, message: String }`; messages are exactly "It works.", "The key was rejected.", "The service couldn't be reached." (rescue `Anthropic::Errors::AuthenticationError`, `PermissionDeniedError` → rejected; any other `Anthropic::Errors::APIError` → couldn't be reached); never includes provider text.
  - Controller `Supports::AnthropicSettingsController < ApplicationController`, routes under the API scope:
    - `GET /api/v1/accounts/:account_id/ai_settings` → `{ account: { has_key, key_last4, model, updated_at, updated_by } | null, site: {…} | null (site admins only), policy: { allow_account_keys }, in_effect: { source, model, account_key_ignored } }`
    - `PUT` same path (`api_key?`, `model?`) and `DELETE` same path → the school row
    - `PUT /api/v1/accounts/:account_id/ai_settings/site` (`api_key?`, `model?`, `allow_account_keys?`) and `DELETE` → the site row
    - `POST /api/v1/accounts/:account_id/ai_settings/test` (`scope: "account"|"site"`, optional `api_key`, optional `model`) → `{ ok, message }`
  - Route names: `account_ai_settings_api`, `account_ai_settings_site_api`, `account_ai_settings_test_api`. (The page route is added in Task 4.)

- [ ] **Step 1: Write failing specs.**
  - Connection test: stubbed client success → `ok: true`; `AuthenticationError` → rejected message; `APIConnectionError` → unreachable message; the returned message never contains the key or the provider error text.
  - Controller: GET as school admin returns `account: nil` before a key and `has_key: true, key_last4: "…"` after; PUT stores the key; **no response body, in any example, contains the key** (assert on every action); PUT with `api_key: ""`, `"   "` or omitted leaves the old key; a key sent with surrounding spaces or a newline is trimmed; PUT with a model outside the list → 422 whose error text doesn't contain the key; DELETE removes only the key; site endpoints are 401 for a school admin and work for a site admin; `GET` `site` is nil for a school admin; setting `allow_account_keys: false` makes `in_effect.source` fall to the site key and `account_key_ignored: true`, and back on restores it, with the school key intact; teacher → 401; non-root account id → 404; test endpoint with `scope: "account"` uses the stored key when no `api_key` is sent, uses the typed one when sent, and the 11th call in a minute by one user → 429; each save and delete writes one `Rails.logger.info` line containing the scope, action and user id and not the key, and sets `updated_by`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** `find_root_account` (404 unless `@account.root_account?` and the id matches the domain's root account family), `authorize_account!` (`authorized_action(@account, @current_user, :manage_account_settings)`), `authorize_site!` (`Account.site_admin.grants_right?(@current_user, :manage_site_settings)`, else `render_unauthorized_action`). Write with `create_or_find_by!` plus `update!`; `updated_by: @current_user`. The test endpoint's limit is per user, 10 per minute, counted with `Rails.cache.increment` on a key that expires in 60 seconds. Responses are built by one `as_json_for(setting)` helper that cannot include `api_key`.
- [ ] **Step 4: Run the specs and rubocop on the new files and `routes.rb`'s touched region only.** Expected: PASS.
- [ ] **Step 5: Commit** the new files plus `config/routes.rb`.

---

### Task 4: The page entry and the hub link

**Files:**
- Modify: `app/models/account.rb` (new `TAB_AI_SETTINGS` using the next unused number; the tab in both branches of `tabs_available`), `config/routes.rb` (page route), `app/controllers/supports/anthropic_settings_controller.rb` (`page` action), `ui/features/admin_hub/react/hubModel.ts` (`ai_settings: 'access'`), `ui/featureBundles.ts`
- Create: `ui/features/ai_settings/index.tsx`, `ui/features/ai_settings/package.json`
- Test: `spec/models/account_ai_settings_tab_spec.rb`, additions to the controller spec, `ui/features/admin_hub/react/__tests__/hubModel.test.ts` (create if absent, otherwise extend the existing test for `TAB_SECTION`)

**Interfaces:**
- Consumes: the API paths from Task 3.
- Produces: `GET /accounts/:account_id/ai_settings` (route name `account_ai_settings`) renders `<div id="ai_settings_app">` with `ENV.AI_SETTINGS = { account_id: String, is_site_admin_account: Boolean, can_manage_site: Boolean, models: [{value, label}], default_model: String }` and the `ai_settings` JS bundle.

- [ ] **Step 1: Write failing tests.** Tab: present for an admin who may manage settings on a root account when `iep_scan` is enabled for it; absent when the flag is off, for a non-admin, and for a sub-account; present on the site admin account for a site admin (`manage_site_settings`). Page: renders for those admins (200, `js_env` has the keys above), 401 for others, 404 for a sub-account. Hub: `TAB_SECTION.ai_settings` is `'access'`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Tab shape follows the existing ones: `{ id: TAB_AI_SETTINGS, label: t("AI settings"), css_class: "ai_settings", href: :account_ai_settings_path }`. The `page` action mirrors `Supports::CaseloadController#page` (`js_env`, `js_bundle :ai_settings`, `render html:`). `ui/featureBundles.ts` gets `ai_settings: () => import('./features/ai_settings/index')`; `index.tsx` mirrors `ui/features/supports/index.tsx` and mounts `AiSettingsApp` (Task 5; until then export a placeholder component so the bundle compiles).
- [ ] **Step 4: Run Ruby and Vitest specs; `bin/rubocop` on `account.rb` must show no new offenses (compare with the count at HEAD).** Expected: PASS.
- [ ] **Step 5: Commit.**

---

### Task 5: The settings screen

**Files:**
- Create: `ui/features/ai_settings/react/AiSettingsApp.tsx`, `KeySection.tsx`, `types.ts`
- Modify: `ui/features/ai_settings/index.tsx` (mount the real app)
- Test: `ui/features/ai_settings/react/__tests__/AiSettingsApp.test.tsx`

**Interfaces:**
- Consumes: the Task 3 API shapes and `ENV.AI_SETTINGS` (Task 4).
- Produces: `AiSettingsApp({config})`; `KeySection({title, scope, setting, models, busy, onSave, onRemove, onTest, extra?})` where `setting = { has_key, key_last4, model } | null`, `onSave({api_key?: string, model?: string})`, `onTest({api_key?: string, model?: string})`.

- [ ] **Step 1: Write failing Vitest specs (msw).**
  - Loads settings; the school section shows "Key ending 4f2a" with Replace and Remove and **no input holding the key**; with no key it shows an empty password field (`autocomplete="off"`).
  - Saving sends only what was typed (an empty key field is not sent), then clears the field and announces "Saved." in a `role="status"` region.
  - Remove asks for confirmation, then deletes and announces it.
  - "In effect" text for each source (account, site, file, none) and the notice when `account_key_ignored`.
  - The site section appears only when `can_manage_site`; on the site admin account the school section is absent. The "Let schools use their own key" switch PUTs `allow_account_keys`.
  - Test connection shows "It works." or the reason from the API, in the status region; a failed save shows the server's message.
  - Keyboard: every control reachable by Tab; the model select labelled; focus returns to the Replace button after saving.
- [ ] **Step 2: Run** `yarn test ui/features/ai_settings`. Expected: FAIL.
- [ ] **Step 3: Implement** in the hub's Material 1 look (white cards at `ELEVATION[4]`, `SURFACE` page background, Roboto, a raised primary button and flat secondary buttons) with the tokens from `../../self_paced_home/react/material`. The key field is a held-in-state value cleared after a successful save. No key is ever put in the URL or in `localStorage`.
- [ ] **Step 4: Run Vitest, `npx biome check --write` on the new files only, and `yarn check:ts` (the only expected errors are the existing `admin_hub/HubApp.tsx` ones).** Expected: PASS.
- [ ] **Step 5: Commit.**

---

## Self-review notes

- Spec coverage: data model and order of use (1); extractor (2); API, permissions, security, test connection (3); hub entry and page route (4); screen (5). The spec's audit-event open item is resolved here as `updated_by` plus a log line (Task 3); a full audit trail is out of scope. Amend that line in the spec when executing.
- The spec calls the hub entry "one more entry in `hubModel.ts`". The hub is built from account navigation tabs, so the entry is the tab in Task 4 plus the `TAB_SECTION` line.
- The page route is account-scoped (`/accounts/:account_id/ai_settings`) as in the spec; the site admin account uses the same page with only the site section.
- Out of scope, as in the spec: per-user keys, usage or cost tracking, other AI features.
