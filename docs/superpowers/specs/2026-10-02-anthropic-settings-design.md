# Anthropic settings design

Date: 2026-10-02
Builds on: `docs/superpowers/specs/2026-10-01-iep-scan-design.md` (the IEP scan reads its key from `anthropic.yml` today).
Flag: none. The page shows whenever IEP scanning is available (flag `iep_scan` on for the account); the key itself gates nothing else.

## Purpose

Let admins supply the Anthropic API key and related settings from the admin area instead of editing a server file. A school
(root account) can bring its own key, or use a shared site-wide one; the site decides whether schools may bring their own.

Success: a school admin saves a key, tests it, and the next IEP scan uses it; a site admin sets a shared key and can forbid
school keys; nobody can read a saved key back; an install that only has `anthropic.yml` keeps working.

## Decisions recorded in this design

- **Whose key (user, 2026-10-02):** both. A school key, a site-wide key, and a site policy `allow_account_keys`.
- **Where it lives (user, 2026-10-02):** the admin hub, as one more entry; the page is a new, separate screen. `HubApp.tsx`
  (which has uncommitted changes) is not touched.
- **Models offered (design):** `claude-opus-5-5` (default), `claude-sonnet-5-5`, `claude-haiku-4-5`. Not free text.
- **Opting out (design):** no separate on/off switch. Removing the key is how a school stops using its own.

## Not in scope

Per-user keys, usage or cost tracking, keys for any other AI feature, rotating keys on a schedule.

## Data model

One table, `anthropic_settings` (`Supports::AnthropicSetting`):

- `root_account_id` (nullable; null is the single site-wide row), unique among non-null values and unique for null.
- `api_key` (text, encrypted with Active Record `encrypts`), `key_last4` (string, so the page can say "ending 4f2a" without
  decrypting), `model` (string, one of the three above, default `claude-opus-5-5`).
- `allow_account_keys` (boolean, default true; meaningful on the site-wide row only).
- `updated_by_id` (user), timestamps.

## Which key is used

`Supports::AnthropicConfig.for(root_account)` returns `{api_key:, model:, source:}` or nil, trying in order:

1. the school's row, if it has a key and the site row does not set `allow_account_keys` to false: `source: :account`;
2. the site-wide row, if it has a key: `source: :site`;
3. `anthropic.yml` (`api_key`, `model`) from the private settings: `source: :file`;
4. nil, which `IepExtractor` reports as "IEP scanning isn't set up for this school."

`IepExtractor` reads its key and model from this and nowhere else. The model from the row or file is checked against the
allowed list; anything else falls back to the default.

## The settings page

`/accounts/:account_id/ai_settings`, a React page in Material 1 matching the admin hub (Roboto, the hub's surface and cards).
The hub shows it as an account tab (css class `ai_settings`, in the "Access and security" section of `hubModel.ts`), added to
`Account#tabs_available` for a root account when the viewer may manage account settings and `iep_scan` is on.

- **School section** (anyone who may manage the account's settings): the key as a write-only field. Once saved it shows
  "Key ending 4f2a" with Replace and Remove. A model select. Which key is in effect and why ("This school's key", "The site's
  shared key", "The server's configuration", "None: scanning isn't set up"). If the site forbids school keys and the school has
  one, a notice says it is not being used.
- **Site section** (site admins only): the shared key and model the same way, and the "Let schools use their own key" switch.
- **Test connection** for whichever key the section is about: one small request. The page shows "It works" or a plain reason
  ("The key was rejected", "The service couldn't be reached"), never the key or the raw error.
- Saving sends only what was typed: an empty key field means "leave the key as it is".

## API

All JSON under `/api/v1/accounts/:account_id/ai_settings`:

- `GET`: `{account: {has_key, key_last4, model, updated_at, updated_by}, site: {…} | null (site admins only), policy:
  {allow_account_keys}, in_effect: {source, model}}`. Never contains a key.
- `PUT`: `{api_key?, model?}` for the school.
- `DELETE`: removes the school's key.
- `PUT …/site` and `DELETE …/site`: the same for the site row, plus `allow_account_keys`; site admins only.
- `POST …/test` (`scope: "account"|"site"`, optionally `api_key` to test a key before saving): returns `{ok, message}`.

Permissions: school actions need `:manage_account_settings` on the root account; site actions need `:manage_site_settings` on
the site-admin account. Everything requires the root account, so a sub-account gets 404.

## Security

- The key is encrypted at rest, write-only through the API, and never in responses, logs, error reports or the access log.
  `api_key` is added to the filtered parameters.
- Only the last four characters are kept in the clear.
- Test connection reports only a fixed set of messages. It does not echo the provider's error text.
- A key typed into a form is held in component state only until sent, and the field is cleared after saving.
- Every save and delete records `updated_by` and writes one log line (who, scope, action, never the key). A full audit trail is out of scope.

## Testing

- `AnthropicConfig`: each rung of the order, policy off hides the school's key, an unknown model falls back, nil when nothing.
- `AnthropicSetting`: validations, encryption at rest (raw column does not contain the key), `key_last4`.
- API specs: permission matrix (school admin, site admin, teacher, sub-account), the key never in a response, empty `api_key`
  leaves the key, policy switch, test endpoint messages with the client stubbed.
- `IepExtractor`: uses the config's key and model (existing specs adjusted).
- UI (Vitest): write-only field, Replace/Remove, which key is in effect, site section shown only to site admins, test results,
  keyboard use, announcements.

## Open items

None.
