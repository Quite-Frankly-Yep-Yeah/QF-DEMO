# Account sidebar and themes (Phase 1)

## Goal

Every user can pick a personal theme from a new accounts sidebar. The theme
restyles the top bar, global nav and tray, and the Material pages. Phase 1
proves the system with one Catppuccin theme (Mocha) next to the default.

## Scope

In scope:

- A new accounts sidebar: profile info at the top and one Themes button.
- A speech-bubble popover opened by that button, listing themes.
- A runtime theme token layer (CSS custom properties).
- Two themes: `light` (today's look, the default) and `mocha`.
- Per-user persistence in `preferences[:theme]`.

Out of scope:

- The left-side section tabs (`_left-side.scss`); they are being removed.
- Legacy (non-Material) page bodies; they are being phased out and will sit
  as light content in a dark frame on Mocha.
- Other Catppuccin flavors (Latte, Frappe, Macchiato) and other themes.
- Other account buttons (notifications, security, files).
- Retiring the old Account tray content and legacy settings pages.

## Phases

1. This spec: accounts sidebar, Themes popover, token layer, `light` + `mocha`.
2. More themes (remaining Catppuccin flavors and others), more account
   buttons, and retiring the legacy tray and settings pages.

## Design

### Token layer

- `ui/shared/material/themes.ts` maps a theme id to tokens: `appBar`,
  `onAppBar`, `surface`, `paper`, `ink`, `inkSecondary`, `divider`, `accent`.
- The maps live in one JSON source imported by both the server and the React
  picker, so they cannot drift.
- `ui/shared/material/index.ts` exports `var(--qf-...)` strings in place of
  the hex `APP_BAR`, `SURFACE` and `INK` values. `ELEVATION` and `PALETTE`
  are unchanged.
- A `useThemeTokens()` hook returns the resolved hex values of the active
  theme, for call sites that need real colors (`contrast()`, `ink()`,
  `tint()`), which cannot take `var()`.

### Applying a theme

- A layout helper renders `<html data-theme="...">` from the user's saved
  preference, plus one inline `<style>` block defining
  `:root[data-theme=x] { --qf-...: ... }` for every theme. The theme is
  server-rendered, so there is no flash on load.
- No preference, or an unknown id, falls back to `light`.
- `ENV.THEME` exposes the active id to the frontend.
- `light` token values equal today's Material values, so nothing changes
  until a user picks another theme.

### Nav and Material re-skin

- New `app/stylesheets/base/_themes.scss`, scoped by `data-theme`, restyles
  the global nav (`ic-app-header`, menu items) and tray backgrounds, text and
  hover states using `--qf-app-bar`, `--qf-on-app-bar` and `--qf-paper`. The
  compiled brand CSS is not edited.
- The Material pages (admin hub, grading queue, self-paced dashboard, new
  login) replace uses of `APP_BAR`, `SURFACE` and `INK` with the `var()`
  exports and use `useThemeTokens()` where a resolved color is required.

### Accounts sidebar

- New `ui/features/account_sidebar` replaces the body of the Account tray in
  `SideNav.tsx`. The tray opens as before.
- Header: avatar, name and email from `ENV.current_user`. Display only.
- List: a full-width Material `AccountButton` row ("Themes", palette icon,
  chevron). Phase 2 adds rows without a layout change.
- Popover: a speech bubble with a tail pointing at the button, on `paper`
  with `ELEVATION[8]`. It lists theme cards (swatch dots, name, checkmark on
  the active one). Escape or an outside click closes it. Focus handling and
  `aria-` labels follow the existing popover pattern.
- Switching: picking a card sets `data-theme` on `<html>` immediately, then
  saves with `doFetchApi` PUT to the preferences endpoint. On failure it
  reverts and shows a flash error, as `DarkModeToggle` does.

### Backend

- A `theme` setter on `UsersController` validates against the known theme
  ids and stores `preferences[:theme]`. An unknown id returns 400 and stores
  nothing. No migration is needed because preferences is a hash.
- The layout sets `ENV.THEME`.

## Testing

- RSpec: `UsersController` accepts a known id, rejects an unknown id with 400
  and saves nothing; the layout renders `data-theme` for a saved theme and
  `light` for none or an invalid one.
- Vitest, `themes.ts`: every theme defines every token; ink on surface and
  onAppBar on appBar are at least 4.5:1.
- Vitest, `AccountSidebar`: the header renders, the Themes button opens the
  popover, Escape closes it.
- Vitest, theme cards: picking one sets `data-theme` and calls the API; a
  failed save reverts and shows an error.
- Manual: `yarn webpack-development`, pick Mocha, confirm the top bar, tray
  and Material pages change and the choice persists across reload; a user who
  never chose a theme sees no change.

## Rollout

No feature flag. The default is `light` and matches today's look, so nothing
changes until a user picks a theme.
