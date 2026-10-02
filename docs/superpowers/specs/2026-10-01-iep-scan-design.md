# IEP scan design (Phase 1)

Date: 2026-10-01
Builds on: the supports imports flow (`Supports::Import`, `Supports::ImportsController`, `ui/features/supports/react/ImportPanel.tsx`).
Flag: `iep_scan`, off by default, per account.

## Purpose

Let an account admin or case manager upload an IEP (PDF or image) for a student and have the app propose the matching
supports: a plan plus accommodations from the account's catalog. A person reviews and confirms; nothing is applied
automatically, and an applied scan can be undone.

Success: a clean IEP produces a preview whose accommodations map to catalog kinds with valid parameters, each shown with
the quote it came from; the reviewer can fix or drop any item; applying creates or updates the plan and its accommodations
in one step; undo restores the prior state.

## Decisions recorded in this design

- **Model access (user, 2026-10-01):** the Anthropic API directly, through the `anthropic` gem, behind an adapter. Not
  `inst_llm`, because the existing AI features are being removed.
- **Original file (user, 2026-10-01):** kept, attached to the plan, encrypted and access-logged.
- **Student matching (user, 2026-10-01):** both modes. Phase 1 is single upload with the student picked first. Phase 2 is
  bulk upload where the system proposes a match and a human confirms each one.
- **Approach (user, 2026-10-01):** extend `Supports::Import` with `format: "iep_scan"`; reuse its preview, apply and undo.
- **UI (user, 2026-10-01):** Material 1, like the newer parts of the app, using `@canvas/material`.

## Not in scope

- Bulk upload and student matching (Phase 2, its own spec).
- OCR beyond what the model does natively.
- Auto-applying anything, or extracting anything not in the account's catalog as an action.

## Data model

- `support_imports` gains `student_id` (nullable; CSV imports have none), `plan_id` (set on apply), `extraction_state`
  (`queued`, `running`, `ready`, `failed`) and `extraction_error`.
- `format` gains `"iep_scan"`. `preview["rows"]` keeps its shape; scan rows add `source_quote`, `page` and `confidence`.
  The preview also carries `student_name_on_doc`, `dob_on_doc`, `plan_type`, the plan dates and an `unmapped` list.
- The original file is an encrypted attachment on the plan, so it outlives the import. Each open or download is logged.
- `Supports::Plan::SOURCES` gains `scan`.
- Extraction results are stored encrypted, like `data` and `applied_changes` today.

## Extraction pipeline

1. `POST /api/v1/supports/imports` takes `account_id`, `student_id` and a PDF or image (up to 20 MB). It creates an import in
   `queued` and enqueues a job.
2. `Supports::IepExtractor` sends the document to Claude with the account's active catalog (kinds and parameter schemas) in
   the prompt, and structured output limited to that shape. It returns the name and DOB on the document, `plan_type`, plan
   dates, `accommodations[]` (`kind`, `params`, `source_quote`, `confidence`, `page`) and `unmapped[]` (quote and page).
   The model call sends the document only, never a student ID. The API key comes from Rails credentials.
3. Each accommodation is checked with `AccommodationType.parameter_errors`. Failures stay in the preview as "needs fixing"
   and block apply until edited or dropped.
4. The name and DOB are compared with the chosen student. A mismatch is a warning on the preview.
5. The import moves to `ready`. Review, apply and undo are the existing flow. Applying creates or updates the plan and its
   accommodations in one transaction and calls `bump_version!` so teachers acknowledge the changed list again.

**Failure handling:** an API error, an unreadable scan or a refusal sets `failed` with a plain-language message and keeps the
file. Retry is allowed, with exponential backoff on transient errors.

## Review UI (Material 1)

Built in `ui/features/supports/react`, beside `ImportPanel.tsx`, with the tokens from `@canvas/material`: Roboto, the brand
blue app bar, the `#EEEEEE` surface, white cards at `ELEVATION` 1 to 4, and `PALETTE` colors for the kind of each
accommodation. Text colors come from `INK` and must meet 4.5:1 contrast (use `ink()`). The result should look like the admin
hub and grading queue, not the InstUI default.

- **Entry:** a "Scan an IEP" action opens a student picker (`PersonPicker`) and a file drop zone. While extraction runs the
  screen shows a progress state and polls.
- **Preview:** one card per proposed accommodation, with its kind and plain-language parameters (from
  `AccommodationType.parameters_text`), the source quote and page, a confidence badge, an include toggle and edit-in-place
  for parameters (`ParametersFields`).
- **Blocking states:** cards that fail validation are flagged and block apply until fixed or dropped.
- **Not mapped:** a separate section for goals, services and other items. Each can be kept as an `informational` note for the
  teacher or dropped.
- **Header:** the name/DOB mismatch warning, if any, plus editable plan type and dates.
- **Actions:** a raised primary button to apply, a flat button to discard, and a flat button to undo once applied.
- **Accessibility:** keyboard operable, focus managed on state changes, status changes announced, contrast checked.

## Permissions and privacy

- Upload, review and apply need the same permission as the CSV import. Case managers reach only students on their caseload.
- Opening or downloading the original is access-logged and limited to people who can manage that plan.
- Student-identifying text is never written to logs or error reports.
- The feature flag gates the endpoints and the UI entry.

## Testing

- **Extractor:** specs with the Anthropic client stubbed from recorded structured responses: a clean IEP, an unmapped item, a
  bad parameter, a name mismatch, an API error and a refusal.
- **Import flow:** request specs for upload limits, the permission matrix, the state transitions, and apply and undo.
- **UI:** Vitest component tests for the cards, the blocking states and the edit flow.
- **Accuracy:** a set of synthetic IEPs (no real student data) run as an opt-in eval against the live API, measuring kind and
  parameter accuracy. It is not part of CI.

## Open items

- Confirm the `anthropic` gem and a model id with the claude-api skill when writing the plan.
- The district's data-processing agreement and retention terms with Anthropic must be in place before real student data is
  used. This is a launch blocker, not a build blocker.
