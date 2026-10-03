# SpeedGrader Material 1 theme design

Date: 2026-10-01
Follows: the grading queue restyle (`ui/features/workflow_grading_queue`), which introduced `@canvas/material`.
Flag: none. A body class, `speedgrader-material`, is the switch.

## Purpose

Theme SpeedGrader in Material 1 so it matches the newer parts of the app (admin hub, grading queue): Roboto, the brand
blue app bar, a grey surface, elevated white cards and the shared palette. Styling only; no behavior changes.

Success: SpeedGrader's header, panes, sidebar controls, dialogs and React trays all read as Material 1, with nothing
moved, resized or broken, and removing the body class restores today's look.

## Decisions recorded in this design

- **Scope (user, 2026-10-01):** everything: page chrome, sidebar controls, and the trays and dialogs.
- **Mechanism (user, 2026-10-01):** hybrid. SCSS for the page and jQuery UI dialogs; `InstUISettingsProvider` for the React
  trays, which portal out of the page.
- **Not in scope:** the student viewer iframe contents, high-contrast styling, any JS or DOM structure change.

## Architecture

- **Tokens:** `app/stylesheets/base/_material.scss` mirrors `ui/shared/material/index.ts` (app bar blue via the same
  darkening rule, `#EEEEEE` surface, Roboto, elevations 1/2/4, the 8-color palette). Each file carries a comment pointing
  at the other, since SCSS cannot import TypeScript.
- **Page theming:** a `.speedgrader-material` block in `speed_grader.scss` styles `#gradebook_header`, `#left_side`,
  `#right_side`, sidebar sections as cards, buttons, selects, the grade input, the comment box, the rubric, and the jQuery
  UI dialogs and select menus. The class is added to the body in `speed_grader.html.erb`.
- **High contrast:** the block sits behind `@if not $use_high_contrast`, as `_left-side.scss` does.
- **React trays:** a `SpeedGraderMaterialTheme` wrapper over `InstUISettingsProvider` supplies colors, shadows and a 4px
  radius. It wraps the roots of the rubric tray, comment library, post policies, assessment audit and settings menu.
- **Layout:** only colors, shadows, borders, radius and type change. Sizes and positioning (fixed layout, resizers) are not
  touched.

## Build order

Each step is its own commit and leaves the page usable.

1. Tokens: `_material.scss`, the body class and the high-contrast guard. No visible change.
2. Chrome: header bar, grey surface, the two panes, sidebar sections as cards.
3. Controls: buttons, selects, grade input, comment box, rubric, jQuery UI dialogs and select menus.
4. React trays: the wrapper, applied one mount point at a time.

## Testing

- A vitest unit test checks that `SpeedGraderMaterialTheme` supplies the expected tokens to a child component. SCSS has no
  unit test.
- Run `ui/features/speed_grader` tests after each step to catch broken mounts and selectors.
- `docker compose run --rm web yarn build:css` after the SCSS steps to catch Sass errors.
- Visual check in the browser after each step, by the user.

## Risks

- **Layout breakage:** SpeedGrader's layout depends on fixed positioning. Mitigated by restyling only the properties
  listed above.
- **Missed components:** Instructure UI components that read their own variables may ignore the overrides. Misses are
  listed in the plan, not hacked around.
- **Token drift:** the SCSS and TypeScript token files can diverge. The cross-reference comments only partly cover this.
