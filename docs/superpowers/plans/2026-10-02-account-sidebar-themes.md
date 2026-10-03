# Account Sidebar and Themes (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every user can pick a personal theme (Light or Catppuccin Mocha) from a new accounts sidebar, restyling the global nav and the Material pages.

**Architecture:** Themes are token maps in one JSON file read by Ruby and TypeScript. The layout sets `<html data-theme>` and emits CSS custom properties per theme. Material pages and the global nav read `var(--qf-*)`. A React `AccountSidebar` (profile header and a Themes button opening a speech-bubble popover) replaces the profile block of the Account tray and saves the choice to `preferences[:theme]`.

**Tech Stack:** Rails 7 (UsersController, ERB layout, Sass), React 18 + TypeScript, `@instructure/ui-popover`, Vitest, RSpec.

**Spec:** `docs/superpowers/specs/2026-10-02-account-sidebar-themes-design.md`

## Global Constraints

- Theme ids are exactly `light` and `mocha`; `light` is the default and fallback for none or unknown.
- Tokens, exactly: `appBar`, `onAppBar`, `surface`, `paper`, `ink`, `inkSecondary`, `divider`, `accent`. CSS variables are `--qf-` plus the kebab-case name (`--qf-app-bar`, `--qf-on-app-bar`, `--qf-ink-secondary`).
- `light` token values equal today's Material values (`appBar #2B7ABC`, `surface #EEEEEE`, `ink rgba(0,0,0,0.87)`, `inkSecondary rgba(0,0,0,0.6)`, `paper #FFFFFF`).
- Contrast of `ink` on `surface`, `ink` on `paper`, and `onAppBar` on `appBar` is at least 4.5:1 for every theme (hex tokens only; the pairs are tested on the opaque `ink`/`onAppBar` colors).
- Out of scope: `_left-side.scss`, legacy page bodies, other themes, other account buttons, retiring the old tray content.
- No feature flag, no migration.
- Commits: lines under 60 chars, include `refs none` / `flag=none` / `test plan:`, end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No git identity is configured: set `GIT_AUTHOR_NAME=niko GIT_AUTHOR_EMAIL=cbabushka58@gmail.com` and the `GIT_COMMITTER_*` pair per command, and use `git commit -- <paths>` because the tree holds unrelated changes.
- Run anything using yarn, rspec or rails in the web container: `docker compose run --rm web <cmd>`.

## Review Focus

- A user with a saved id that is later removed from the theme list gets `light`, not a broken page (test in Task 2).
- `PUT /users/:id/settings` with no `theme` param leaves a saved theme untouched (Task 2).
- A user with a theme whose request carries a non-string `theme` (array or hash) gets 400 and no change (Task 2).
- Anonymous visitors (login page, no `@current_user`) render `light` without error (Task 2).
- Escape closes the popover and returns focus to the Themes button (Task 5).
- A save that rejects reverts `data-theme` to the prior value and shows an error, and a second pick afterward still works (Task 5).

---

### Task 1: Theme tokens

**Files:**
- Create: `ui/shared/material/themes.json`
- Create: `ui/shared/material/themes.ts`
- Test: `ui/shared/material/__tests__/themes.test.ts`

**Interfaces:**
- Produces: `themes.json` shape `{"light": {"name": string, "tokens": {<8 token keys>: string}}, "mocha": {...}}`; `themes.ts` exports `type ThemeId = 'light' | 'mocha'`, `type ThemeTokens`, `THEMES: Record<ThemeId, {name: string; tokens: ThemeTokens}>`, `DEFAULT_THEME: ThemeId`, `isThemeId(value: unknown): value is ThemeId`, `tokenVar(name: keyof ThemeTokens): string` (returns `var(--qf-app-bar)` style strings).

- [ ] **Step 1: Write the failing test** in `themes.test.ts`: `every theme defines every token` (keys equal the 8 constraint names), `ink on surface, ink on paper and onAppBar on appBar are at least 4.5:1` (use `contrast` from `../index`), `isThemeId rejects unknown values` (`'mocha'` true; `'latte'`, `undefined`, `5` false), `tokenVar maps camelCase to a css variable` (`tokenVar('inkSecondary') === 'var(--qf-ink-secondary)'`), `light matches the existing Material values`.
- [ ] **Step 2: Run to verify it fails.** Run: `docker compose run --rm web yarn test:vitest ui/shared/material`. Expected: FAIL, module `../themes` not found.
- [ ] **Step 3: Create `themes.json`** with `light` (values from Global Constraints; `onAppBar #FFFFFF`, `divider #E0E0E0`, `accent #2B7ABC`, and `ink` and `inkSecondary` as hex equivalents `#212121` and `#666666` of the current rgba values) and `mocha` using Catppuccin Mocha: `appBar #181825` (mantle), `onAppBar #CDD6F4` (text), `surface #1E1E2E` (base), `paper #313244` (surface0), `ink #CDD6F4`, `inkSecondary #A6ADC8` (subtext0), `divider #45475A` (surface1), `accent #CBA6F7` (mauve). Verify the contrast pairs pass; if one fails, move that token to the nearest Catppuccin color that passes.
- [ ] **Step 4: Implement `themes.ts`** per the Interfaces block, importing `./themes.json` (`resolveJsonModule` is already on in this repo; confirm with the test run).
- [ ] **Step 5: Run to verify it passes.** Same command, Expected: PASS.
- [ ] **Step 6: Commit.** `git add ui/shared/material && git commit -- ui/shared/material` with message `add theme tokens for light and mocha`.

---

### Task 2: Server-side theme (preference, helper, layout)

**Files:**
- Create: `lib/qf_themes.rb`
- Modify: `app/controllers/users_controller.rb` (settings action, around lines 1830-1866), `app/controllers/application_controller.rb` (default `js_env`, near the `current_user:` entry), `app/helpers/application_helper.rb`, `app/views/layouts/_head.html.erb:18`
- Test: `spec/lib/qf_themes_spec.rb`, `spec/controllers/users_controller_spec.rb` (new `describe "settings theme"`), `spec/helpers/application_helper_spec.rb`

**Interfaces:**
- Consumes: `ui/shared/material/themes.json` from Task 1.
- Produces: `QfThemes.ids -> Array<String>`, `QfThemes.valid?(id) -> Boolean` (false for non-strings), `QfThemes.css -> String` (one `:root[data-theme="x"]{--qf-*:...;--ic-brand-global-nav-bgd:<appBar>;--ic-brand-global-nav-logo-bgd:<appBar>;--ic-brand-global-nav-ic-icon-svg-fill:<onAppBar>;--ic-brand-global-nav-ic-icon-svg-fill--active:<onAppBar>}` rule per theme); `ApplicationHelper#current_theme_id -> String`; `ENV.THEME` (string); `PUT users/:id/settings` accepts `theme` and returns it in the JSON for both GET and PUT, as `theme`.

- [ ] **Step 1: Write the failing specs.**
  - `qf_themes_spec.rb`: `ids` equals `%w[light mocha]`; `valid?("mocha")` true; `valid?("latte")`, `valid?(nil)`, `valid?(["mocha"])` false; `css` contains `:root[data-theme="mocha"]` and `--qf-surface:#1E1E2E`.
  - `users_controller_spec.rb`: PUT `settings` with `theme: "mocha"` stores `preferences[:theme] == "mocha"` and responds with `theme: "mocha"`; `theme: "latte"` and `theme: ["mocha"]` respond 400 and leave the stored value unchanged; a PUT without `theme` keeps a saved `mocha`; GET returns `theme: "light"` for a user with none.
  - `application_helper_spec.rb`: `current_theme_id` returns the saved id, `"light"` when none, `"light"` when the saved id is no longer valid, and `"light"` when `@current_user` is nil.
- [ ] **Step 2: Run to verify they fail.** Run: `docker compose run --rm web bin/rspec spec/lib/qf_themes_spec.rb spec/controllers/users_controller_spec.rb -e "settings theme" spec/helpers/application_helper_spec.rb -e current_theme_id`. Expected: FAIL (uninitialized constant `QfThemes`, missing keys).
- [ ] **Step 3: Implement `QfThemes`** in `lib/qf_themes.rb` as a module with `ids`, `valid?`, `css`, memoizing a parse of the JSON via `Rails.root.join("ui/shared/material/themes.json")`; kebab-case the token names for CSS variable names. Add `ApplicationHelper#current_theme_id` (valid saved `@current_user&.preferences&.dig(:theme)`, else `"light"`).
- [ ] **Step 4: Extend the settings action.** In the PUT branch, after the BOOLEAN_PREFS loop: when `params.key?(:theme)`, return `render json: { message: "invalid theme" }, status: :bad_request` unless `QfThemes.valid?(params[:theme])`, otherwise set `user.preferences[:theme]`. Add `theme: QfThemes.ids.include?(user.preferences[:theme]) ? user.preferences[:theme] : "light"` to both the GET `results` and the PUT response. Add `ENV.THEME` as `current_theme_id` in the default `js_env` next to `current_user`. Add `@argument theme [String]` to the API docs.
- [ ] **Step 5: Layout.** In `_head.html.erb`, add `data-theme="<%= current_theme_id %>"` to the `<html>` tag and, after the brand stylesheet link, `<style id="qf-themes"><%= raw QfThemes.css %></style>`.
- [ ] **Step 6: Run to verify they pass.** Same command, Expected: PASS. Then `docker compose run --rm web bin/rubocop lib/qf_themes.rb app/helpers/application_helper.rb` (do not use `-a` on pre-existing files).
- [ ] **Step 7: Commit** the paths above with message `save a per-user theme and render it on html`.

---

### Task 3: Material tokens as CSS variables

**Files:**
- Modify: `ui/shared/material/index.ts`, `ui/features/admin_hub/react/HubApp.tsx`, `ui/features/workflow_grading_queue/react/GradingQueueApp.tsx`
- Create: `ui/shared/material/useThemeTokens.ts`
- Test: `ui/shared/material/__tests__/useThemeTokens.test.tsx`, existing `ui/features/admin_hub/react/__tests__/HubApp.test.tsx`

**Interfaces:**
- Consumes: `THEMES`, `DEFAULT_THEME`, `isThemeId`, `tokenVar` from Task 1; `ENV.THEME` from Task 2.
- Produces: `index.ts` exports `APP_BAR = tokenVar('appBar')`, `SURFACE = tokenVar('surface')`, `INK = {primary: tokenVar('ink'), secondary: tokenVar('inkSecondary')}`, plus new `PAPER = tokenVar('paper')`, `DIVIDER = tokenVar('divider')`, `ON_APP_BAR = tokenVar('onAppBar')`; `ELEVATION`, `PALETTE`, `ROBOTO`, `contrast`, `ink`, `tint` unchanged. `useThemeTokens(): ThemeTokens` returns the tokens of the theme named by `document.documentElement.dataset.theme`, falling back to `DEFAULT_THEME`, and re-renders when that attribute changes (MutationObserver).

- [ ] **Step 1: Write the failing test** for `useThemeTokens`: returns light tokens with no attribute; returns mocha tokens when `data-theme="mocha"`; updates after the attribute changes; unknown value falls back to light.
- [ ] **Step 2: Run to verify it fails.** Run: `docker compose run --rm web yarn test:vitest ui/shared/material`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `useThemeTokens.ts`** and switch the `index.ts` exports as above.
- [ ] **Step 4: Migrate call sites.**
  - In `HubApp.tsx` and `GradingQueueApp.tsx`: every `ink(APP_BAR)` becomes `tokens.appBar` from `useThemeTokens()` (these need a resolved hex), `color: #fff` on the app bar becomes `ON_APP_BAR`, and card and paper `#fff` backgrounds become `PAPER`.
  - Border `rgba(0,0,0,0.2)` becomes `DIVIDER`.
  - The `STYLES` template strings stay string templates, now with `var()` values.
  - Do not touch `ui/features/course_catalog/react/material.ts` (its own copy, not in scope).
- [ ] **Step 5: Run to verify.** `docker compose run --rm web yarn test:vitest ui/shared/material ui/features/admin_hub ui/features/workflow_grading_queue` Expected: PASS; then `docker compose run --rm web yarn check:ts` Expected: no new errors.
- [ ] **Step 6: Commit** with message `read material colors from theme variables`.

---

### Task 4: Global nav and tray styling

**Files:**
- Create: `app/stylesheets/base/_themes.scss`
- Modify: the stylesheet that imports `base/ic_app_header` (find with `grep -rn "base/ic_app_header" app/stylesheets`) to also import `base/themes`
- Modify: `app/stylesheets/base/_ic_app_header.scss` only if the nav text color is hard-coded (see Step 1)

**Interfaces:**
- Consumes: the `--qf-*` and `--ic-brand-global-nav-*` variables emitted by Task 2's `<style id="qf-themes">`.

- [ ] **Step 1: Inspect** which colors in `.ic-app-header`, `.ic-app-header__menu-list-item`, `#profile-tray`-family and the open tray body (`.ReactTrayPortal`, the tray `Tray` container) are hard-coded rather than brand variables (`grep -n "#[0-9a-fA-F]\{3,6\}\|rgba" app/stylesheets/base/_ic_app_header.scss app/stylesheets/base/_SideNav.scss`). Task 2 already covers the nav background and icon fills through the brand variables.
- [ ] **Step 2: Write `_themes.scss`** with rules scoped as `:root:not([data-theme="light"])` that set the tray body (`background: var(--qf-paper); color: var(--qf-ink)`), its links, headings and `hr` (`var(--qf-divider)`), and the nav label text (`var(--qf-on-app-bar)`) for each hard-coded color found in Step 1. Light has no rules, so it renders exactly as today.
- [ ] **Step 3: Build and check visually.** Run: `docker compose run --rm web yarn build:css` then hard-refresh. Expected: no Sass error; with `data-theme="light"` the nav and tray are unchanged. Set `document.documentElement.dataset.theme = 'mocha'` in devtools: the nav, its icons and an open tray turn dark with readable text.
- [ ] **Step 4: Commit** with message `style the global nav and trays from theme tokens`.

---

### Task 5: Accounts sidebar and Themes popover

**Files:**
- Create: `ui/features/account_sidebar/package.json` (`{"name": "@canvas/account-sidebar", "private": true, "version": "1.0.0", "owner": "FOO"}` with `main` pointing at `./react/AccountSidebar.tsx`)
- Create: `ui/features/account_sidebar/react/AccountSidebar.tsx`, `ThemePopover.tsx`, `useThemeChoice.ts`
- Test: `ui/features/account_sidebar/react/__tests__/AccountSidebar.test.tsx`, `ThemePopover.test.tsx`

**Interfaces:**
- Consumes: `THEMES`, `ThemeId`, `isThemeId`, `DEFAULT_THEME` (Task 1); `PAPER`, `INK`, `DIVIDER`, `ELEVATION`, `ROBOTO` (Task 3); `ENV.THEME`, `PUT /api/v1/users/self/settings` returning `{theme}` (Task 2); `doFetchApi` from `@canvas/do-fetch-api-effect`; `showFlashError` from `@canvas/alerts/react/FlashAlert`.
- Produces: `useThemeChoice(): {theme: ThemeId; choose: (id: ThemeId) => Promise<void>}`. `choose` sets `document.documentElement.dataset.theme`, saves, and on failure restores the previous value and calls `showFlashError`. `AccountSidebar` (default export, no props) renders the header and a `data-testid="themes-button"` button. `ThemePopover` (props `{theme: ThemeId; onChoose: (id: ThemeId) => void}`) renders the bubble with one `role="radio"` card per theme.

- [ ] **Step 1: Write failing tests.**
  - `AccountSidebar.test.tsx`: with `ENV.current_user = {display_name: 'Ada Lovelace', avatar_image_url: '', avatar_is_fallback: true}`, it shows "Ada Lovelace" and the email-less header (no crash when `email` is absent); the Themes button is present; clicking it shows radios named "Light" and "Catppuccin Mocha" with the current theme `aria-checked="true"`; pressing Escape closes the popover and focus is on the Themes button.
  - `ThemePopover.test.tsx` (mock `doFetchApi`): picking Mocha sets `document.documentElement.dataset.theme === 'mocha'` and calls `doFetchApi` with `path: '/api/v1/users/self/settings'`, `method: 'PUT'`, `body: {theme: 'mocha'}`; with a rejecting `doFetchApi`, the attribute returns to `light`, `showFlashError` is called, and picking Mocha again calls the API a second time.
- [ ] **Step 2: Run to verify they fail.** Run: `docker compose run --rm web yarn test:vitest ui/features/account_sidebar`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement `useThemeChoice`** per the Interfaces block; initial `theme` is `ENV.THEME` if `isThemeId`, else `DEFAULT_THEME`.
- [ ] **Step 4: Implement `ThemePopover`** as a speech bubble: `@instructure/ui-popover` `Popover` with `placement="end center"`, `shouldContainFocus`, `shouldCloseOnDocumentClick`, and `onHideContent` returning focus to the trigger. Content is a `paper` panel with `ELEVATION[8]`, a CSS-triangle tail on the trigger-facing edge, and one card per `THEMES` entry (swatch dots from `appBar`, `surface`, `paper`, `accent`, the theme name, a checkmark on the active one).
- [ ] **Step 5: Implement `AccountSidebar`**: Avatar, name and (when present) email from `ENV.current_user`, display only; a full-width Material row button "Themes" (palette icon, chevron) that is the Popover trigger.
- [ ] **Step 6: Run to verify they pass.** Same command, Expected: PASS. Then `docker compose run --rm web yarn check:ts` Expected: no new errors.
- [ ] **Step 7: Commit** with message `add the account sidebar with a themes popover`.

---

### Task 6: Wire into the Account tray and verify in the app

**Files:**
- Modify: `ui/features/navigation_header/react/trays/ProfileTray.tsx`
- Test: `ui/features/navigation_header/react/trays/__tests__/ProfileTray.test.tsx`

**Interfaces:**
- Consumes: `AccountSidebar` default export from `@canvas/account-sidebar` (Task 5; add the workspace dependency where the repo's other `@canvas/*` imports are declared in `ui/features/navigation_header/package.json`).

- [ ] **Step 1: Write the failing test** in `ProfileTray.test.tsx`: the tray renders the `themes-button`; the existing assertions (display name, logout button, profile tab links, accessibility toggles) still pass.
- [ ] **Step 2: Run to verify it fails.** Run: `docker compose run --rm web yarn test:vitest ui/features/navigation_header/react/trays/__tests__/ProfileTray.test.tsx`. Expected: FAIL on the missing `themes-button`.
- [ ] **Step 3: Replace** the avatar and heading block in `ProfileTray.tsx` with `<AccountSidebar />`, keeping `LogoutButton`, the profile tab list and the accessibility toggles below it. These legacy items are retired in Phase 2, not here.
- [ ] **Step 4: Run to verify it passes.** Same command, Expected: PASS; then `docker compose run --rm web yarn test:vitest ui/features/navigation_header ui/features/account_sidebar ui/shared/material` Expected: PASS.
- [ ] **Step 5: Rebuild and check in the app.** Run `docker compose run --rm web yarn webpack-development` and `docker compose run --rm web yarn build:css`, hard-refresh, open Account, click Themes, pick Catppuccin Mocha. Expected: the nav, tray and the hub and grading queue pages go dark immediately; reload keeps Mocha; a user with no choice sees no change.
- [ ] **Step 6: Commit** with message `show the account sidebar in the account tray`.
