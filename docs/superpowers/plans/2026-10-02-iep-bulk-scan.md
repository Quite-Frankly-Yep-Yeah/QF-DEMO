# IEP Bulk Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload up to 25 IEPs at once, match each to a student, confirm the matches in a table, then review each scan's accommodations in turn on a rearranged review page.

**Architecture:** A batch is a set of `Supports::Import` scans (`format: "iep_scan"`) with `batch_id` and no student until a person confirms one. The existing background read runs per file and now also stores a student match (`Supports::StudentMatcher`). Matching candidates come from a `Supports::StudentSearch` extracted from the student-search endpoint, so both use the same rules. The existing review, apply and undo endpoints are reused once a student is attached. The UI adds a match table and turns the review page into a workspace with a queue.

**Tech Stack:** Rails, RSpec, `anthropic` gem (existing extractor), React + TypeScript + Vitest, `@canvas-features/supports` UI helpers.

**Spec:** `docs/superpowers/specs/2026-10-02-iep-bulk-scan-design.md`

## Global Constraints

- Flag `iep_scan` gates everything; no new flag.
- Limits: 25 files per batch; each file 20 MB (images 5 MB); 200 MB in all; types PDF, PNG, JPEG (`IepScan::MAX_BYTES`, `MAX_IMAGE_BYTES`, `IepExtractor::CONTENT_TYPES`).
- A student is attached only when a person confirms; nothing is applied without review. A scan with no student is visible only to the user who uploaded it.
- Candidates are limited to students the user may manage (`Supports::Access#can_manage?`); a case manager without the all-students permission is limited to their caseload.
- Match states: `confident` | `ambiguous` | `none`; candidate reasons: `id` | `name` | `partial`; at most 5 candidates.
- Document text, names and IDs live only in the encrypted `extraction`, never in the unencrypted `preview` column; the extractor sends the document only, never a student id.
- UI is Material 1 using the Supports page's own `ui.tsx` helpers and the committed `self_paced_home/react/material` tokens; contrast at least 4.5:1; keyboard operable; status and progress changes announced; strings through `I18n.t`.
- Commits follow `AGENTS.md` (each line under 60 characters, why not what, `flag=iep_scan`, test plan, git-hook ChangeId untouched) plus the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Git has no identity here: set `GIT_AUTHOR_NAME=niko GIT_AUTHOR_EMAIL=cbabushka58@gmail.com GIT_COMMITTER_NAME=niko GIT_COMMITTER_EMAIL=cbabushka58@gmail.com` per command and commit only your own paths with `git commit -- <paths>` (the tree holds unrelated uncommitted work).
- Ruby, yarn and rake run in the container: `docker compose run --rm web ...`. Never run `rubocop -a` on a pre-existing file with unrelated offenses (check `git diff -U0` for unrelated removals afterwards). Wrap long test runs with `timeout`. After frontend changes run `docker compose run --rm web yarn webpack-development`; after backend changes a job uses, `docker compose restart jobs`.
- Migration versions must not be ahead of the container clock (UTC now is 2026-10-02 or later).

## Review Focus

1. Two students with the same name, or an ID that names one student and a name that names another: the match must be `ambiguous`, never silently `confident`. (Task 3)
2. A crafted `PUT imports/:id/student` naming a student the user may not manage (a case manager, another school): refused, nothing attached. (Task 6)
3. A scan with no student read, retried, reviewed, downloaded or skipped by someone other than its uploader: refused. (Tasks 5, 6)
4. A batch where some files fail, a poll fails, a student is changed after apply, or a file is skipped mid-review: nothing applies twice, the table keeps its state, the queue stays correct. (Tasks 5, 7, 8)
5. Batch limits: 26 files, one file over 20 MB, 201 MB in total, a non-PDF: refused whole with a plain message and nothing created. (Task 5)

---

## File Structure

| File | Responsibility |
|---|---|
| `app/services/supports/name_match.rb` (new) | name comparison shared by the mismatch warning and the matcher |
| `app/services/supports/student_search.rb` (new) | the students a viewer may manage, and name/SIS/login search |
| `app/services/supports/student_matcher.rb` (new) | rank candidates for a document's name and ID |
| `db/migrate/20261002140000_create_support_scan_batches.rb` (new) | batches table, `imports.batch_id` |
| `app/models/supports/scan_batch.rb` (new), `import.rb` | batch model; `Import#matched?`, API fields |
| `app/services/supports/iep_extractor.rb`, `iep_scan.rb` | read the student ID; batch creation, match on extract, confirm student |
| `app/controllers/supports/scan_batches_controller.rb` (new), `imports_controller.rb`, `students_controller.rb`, `config/routes.rb` | batch API, confirm student, uploader-only access, shared search |
| `ui/features/supports/react/BatchUpload.tsx`, `MatchTable.tsx`, `ReviewWorkspace.tsx` (new); `ScanPanel.tsx`, `ScanReview.tsx`, `types.ts` | stage 1, the rearranged review page, mode switch |
| `spec/...`, `ui/features/supports/react/__tests__/...` | mirror the files above |

---

### Task 1: The extractor reads the student ID

**Files:**
- Modify: `app/services/supports/iep_extractor.rb`, `app/services/supports/iep_scan.rb` (`proposal_from`)
- Create: `spec/fixtures/supports/synthetic_ieps/with_student_id.pdf` (a synthetic one-page IEP that prints "Student ID: 20094448"; copy the PDF-building approach used for `clean_iep.pdf`), and an entry in `spec/fixtures/supports/synthetic_ieps/expected.yml`
- Test: `spec/services/supports/iep_extractor_spec.rb`, `spec/services/supports/iep_scan_spec.rb`, `spec/evals/supports/iep_extractor_eval_spec.rb`

**Interfaces:**
- Produces: `IepExtractor::Result` gains a final member `student_id` (String | nil), appended so existing positional construction keeps working; `SCHEMA` gains `student_id: {type: %w[string null]}` and lists it in `required`; the stored proposal gains `"student_id_on_doc"` (String | nil).

- [ ] **Step 1: Write failing specs.** Extractor: a reply containing `student_id: "20094448"` yields `result.student_id == "20094448"`; a reply with null yields nil; the schema's `student_id` has no `enum` alongside a type list. Scan: `IepScan.proposal_from(result)["student_id_on_doc"]` equals the result's id. Eval scoring helper: counts `student_id_ok` against `expected.yml`'s `student_id`.
- [ ] **Step 2: Run, expect FAIL** (`docker compose run --rm web bin/rspec spec/services/supports/iep_extractor_spec.rb spec/services/supports/iep_scan_spec.rb`).
- [ ] **Step 3: Implement.** Add the member, the schema property (and prompt line: "student_id: a student or student number printed on the document, else null"), and `"student_id_on_doc"` in `proposal_from`. Add the fixture and its `expected.yml` entry (`student_id: "20094448"`).
- [ ] **Step 4: Run the supports service specs; rubocop only the new/changed lines' files.** Expected: PASS.
- [ ] **Step 5: Commit** the changed files.

---

### Task 2: `Supports::NameMatch` and `Supports::StudentSearch`

**Files:**
- Create: `app/services/supports/name_match.rb`, `app/services/supports/student_search.rb`
- Modify: `app/services/supports/iep_scan.rb` (`mismatch?` uses `NameMatch`), `app/controllers/supports/students_controller.rb` (`search` uses `StudentSearch`)
- Test: `spec/services/supports/name_match_spec.rb`, `spec/services/supports/student_search_spec.rb`; the existing `spec/controllers/supports/students_controller_spec.rb` search specs must keep passing

**Interfaces:**
- Produces:
  - `Supports::NameMatch.words(text) -> [String]` (lowercased alphabetic words), `.exact?(a, b) -> Boolean` (same set of words, both non-empty), `.partial?(a, b) -> Boolean` (one set contained in the other, not exact, both non-empty).
  - `Supports::StudentSearch.new(viewer, root_account)`; `#allowed? -> Boolean` (viewer holds `supports_manage_plans` plus either `supports_view_all_students` in some account of the school, or has a caseload); `#scope -> User relation` of students the viewer may manage (all-students manager: enrolled students plus people with a login at the school and no staff role, as `StudentsController#search` does today; otherwise the viewer's caseload students); `#search(term, limit: 20) -> [{id: String, name: String, sis_user_id: String | nil}]` matching name, SIS user ID or login ID prefix, term of at least 2 characters.

- [ ] **Step 1: Write failing specs.**
  - NameMatch: "Student, Pat Q." vs "Pat Student" is `partial?` and not `exact?`; "Pat Student" vs "student  PAT" is `exact?`; blank is never a match.
  - StudentSearch: for an all-students manager the same results as the old endpoint (copy three of its search examples); for a case manager with a caseload, `scope` and `search` return only caseload students; a case manager with no caseload is `allowed? == false`; a student at another school is never returned.
  - Controller: a case manager on the caseload can now use the endpoint and sees only their caseload; a teacher is still refused.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Move `manage_all_accounts`, `student_ids`, `login_matches` and the SIS-ID display from `StudentsController` into `StudentSearch` unchanged in behaviour; the controller's `search` becomes `render json: {students: search.search(term)}` guarded by `allowed?`. `IepScan.mismatch?` keeps its current meaning (`(doc - known).any? && (known - doc).any?`) expressed through `NameMatch.words`.
- [ ] **Step 4: Run `spec/services/supports spec/controllers/supports`.** Expected: PASS (including every earlier search spec).
- [ ] **Step 5: Commit.**

---

### Task 3: `Supports::StudentMatcher`

**Files:**
- Create: `app/services/supports/student_matcher.rb`
- Test: `spec/services/supports/student_matcher_spec.rb`

**Interfaces:**
- Consumes: `StudentSearch#scope`, `NameMatch` (Task 2).
- Produces: `Supports::StudentMatcher.new(viewer, root_account).call(name:, student_id:) -> StudentMatcher::Match`, where `Match = Struct.new(:state, :candidates, :student_id_on_doc)`, `state` is `"confident" | "ambiguous" | "none"`, each candidate is `{"id" => String, "name" => String, "sis_user_id" => String | nil, "reason" => "id" | "name" | "partial"}` (at most 5, ranked id, then name, then partial), and `Match#to_h` returns `{"state" =>, "candidates" =>, "student_id_on_doc" =>}`.

- [ ] **Step 1: Write failing specs** (names and assertions):
  - `confident` when the ID equals exactly one student's SIS user ID (or login) and the name agrees or is absent.
  - `confident` with no ID when exactly one student's name is an exact match.
  - **`ambiguous` when two students share the exact name** and **when the ID matches student A but the name matches student B**.
  - `ambiguous` for several partial matches; `none` for no candidate; blank name and ID give `none`.
  - Name order, case and punctuation do not matter; a partial name ("Pat") ranks below an exact one.
  - Candidates never include a student outside the viewer's scope (another school; off a case manager's caseload) and never more than 5.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the ranking and state rules from the spec (§ Matching): id match, then exact name, then partial; `confident` only for a single unambiguous top candidate by id, or by exact name when no ID is given.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

---

### Task 4: Batches table and import fields

**Files:**
- Create: `db/migrate/20261002140000_create_support_scan_batches.rb`, `app/models/supports/scan_batch.rb`
- Modify: `app/models/supports/import.rb`
- Test: `spec/models/supports/scan_batch_spec.rb`, `spec/models/supports/import_spec.rb`

**Interfaces:**
- Produces: table `support_scan_batches` (`root_account` and `account` and `user` references, timestamps, replica identity; no student data); `support_imports.batch_id` (nullable FK, partial index); `Supports::ScanBatch` (`belongs_to :root_account, :account, :user`, `has_many :imports, class_name: "Supports::Import", foreign_key: :batch_id`); `Import belongs_to :batch, class_name: "Supports::ScanBatch", optional: true`; `Import#matched? -> Boolean` (`student_id.present?`); `Import#as_api_json` for a scan adds `batch_id: Integer | nil` and `match: Hash | nil` (the extraction's `"match"` with `student_id_on_doc`, or nil).

- [ ] **Step 1: Write failing specs.** Batch validates its owners and has imports; an import with `batch_id` and no student is valid; `matched?` true/false; `as_api_json[:match]` returns the stored match and is absent from the unencrypted `preview` column (assert the raw column does not contain a candidate's name).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Migration** (`tag :predeploy`, `disable_ddl_transaction!`, idempotent, `if_not_exists: true`; `# rubocop:disable Migration/RootAccountId` is not needed because the reference is `null: false`); run it for development and test.
- [ ] **Step 4: Models.** Run specs and rubocop on the new files; redo the migration once to check it is idempotent.
- [ ] **Step 5: Commit.**

---

### Task 5: Batch creation, matching on read, confirming a student

**Files:**
- Modify: `app/services/supports/iep_scan.rb`
- Test: `spec/services/supports/iep_scan_spec.rb`

**Interfaces:**
- Consumes: `StudentMatcher` (Task 3), `ScanBatch`, `Import#matched?` (Task 4), `proposal_from` student ID (Task 1).
- Produces on `Supports::IepScan` (instance, constructed `IepScan.new(account, user)`):
  - `MAX_BATCH_FILES = 25`, `MAX_BATCH_BYTES = 200.megabytes`.
  - `#create_batch!(files:) -> ScanBatch`: checks permission (`StudentSearch#allowed?` and the `iep_scan` flag, else `Importer::Forbidden`), count, per-file type and size, and total size (else `Invalid` with a plain message and **nothing created**); creates one queued import per file with `batch_id`, no student, and enqueues extraction as `create!` does.
  - `#confirm_student!(import, student) -> Import`: for an import the user uploaded or may manage; the student must be one `StudentSearch#scope` allows and `in_school?`; refuses once applied (`ArgumentError`); sets `student`.
  - `IepScan::StudentNotConfirmed < ArgumentError`, raised by `update_review!`, `retry!`, `apply!` and `undo!` when the import has no student.
  - `.extract` on an import with `batch_id` and no student stores `proposal["match"]` from `StudentMatcher.new(import.user, import.account.root_account).call(name:, student_id:).to_h`; `preview_json` and `blockers` tolerate a nil student (no row results, blocker "Confirm the student first.").
  - `#authorize_import!(import)`: with no student only `import.user_id == @user.id` passes; with a student the existing `Access#can_manage?` rule.

- [ ] **Step 1: Write failing specs.** `create_batch!` makes N queued unmatched imports in one batch; **26 files, a file over 20 MB, 201 MB in total, a text file, an image over 5 MB each raise `Invalid` and create nothing**; a user who cannot manage anyone raises `Forbidden`; `extract` on a batch import stores a `match` with the right state for a stub extractor (confident / ambiguous / none) and leaves `student` nil; `confirm_student!` attaches a manageable student, **refuses a student off the case manager's caseload and one at another school**, can change the student before apply, **refuses after apply**; `update_review!` and `apply!` raise `StudentNotConfirmed` before confirmation and work after it; **`authorize_import!` refuses someone other than the uploader for an unmatched scan**; confirming then rebuilds the preview with the name-mismatch warning against the chosen student.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** to the signatures above, reusing `create!`'s file checks (extract them into a private `check_file!(file)`).
- [ ] **Step 4: Run `spec/services/supports`.** Expected: PASS.
- [ ] **Step 5: Commit.**

---

### Task 6: Batch API

**Files:**
- Create: `app/controllers/supports/scan_batches_controller.rb`
- Modify: `app/controllers/supports/imports_controller.rb`, `config/routes.rb`
- Test: `spec/controllers/supports/scan_batches_controller_spec.rb`, `spec/controllers/supports/imports_controller_spec.rb`

**Interfaces:**
- Consumes: `IepScan#create_batch!`, `#confirm_student!`, `#authorize_import!`, `IepScan::StudentNotConfirmed` (Task 5).
- Produces:
  - `POST /api/v1/supports/scan_batches` (`account_id`, `files[]`) → `{id, files: [import.as_api_json...], counts}`; 422 `{errors: [...]}` for `Invalid`; 403 for `Forbidden`.
  - `GET /api/v1/supports/scan_batches/:id` → the same, uploader only (404 for anyone else). `counts` is `{reading, ready, failed, confirmed, applied, skipped}`: reading = queued or running; failed; ready = read, previewed, no student; confirmed = read, previewed, student attached; applied; skipped = discarded.
  - `PUT /api/v1/supports/imports/:id/student` (`student_id`) → the import's `as_api_json`; 403 when the student is not manageable; 409 after apply.
  - On imports: `show`, `review`, `retry`, `document`, `destroy` use `authorize_import!`, so an unmatched scan is the uploader's alone (`destroy` is how a file is skipped); `StudentNotConfirmed` renders 409 `{errors: ["Confirm the student first."]}`.
  - Route names: `supports_scan_batches`, `supports_scan_batch`, `supports_import_student`.

- [ ] **Step 1: Write failing specs.** Create returns the batch and counts; each limit from Task 5 gives 422 with nothing created; flag off 403; show is the uploader's only (**a second user, including an admin, gets 404**); counts for a mix of states; confirming a student works and **a crafted `student_id` for a student the user may not manage gives 403 and attaches nothing**; confirming after apply 409; review/apply before confirming 409; **an admin or other staff user cannot show, download or skip another user's unmatched scan**; skipping an unmatched scan deletes its file; the single-scan `POST imports` still works unchanged.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the controller and the `ImportsController` changes (the existing `require_csv_rights` already exempts scans; add the `student` action and route the nil-student cases through `authorize_import!`); add the routes beside the supports imports routes.
- [ ] **Step 4: Run `spec/controllers/supports spec/services/supports`; rubocop the new files and only the touched hunks of `routes.rb`/`imports_controller.rb`.** Expected: PASS.
- [ ] **Step 5: Commit; restart `jobs`.**

---

### Task 7: Stage 1 UI, upload and match table

**Files:**
- Create: `ui/features/supports/react/BatchUpload.tsx`, `ui/features/supports/react/MatchTable.tsx`
- Modify: `ui/features/supports/react/ScanPanel.tsx` (mode switch and stage orchestration), `ui/features/supports/react/types.ts`
- Test: `ui/features/supports/react/__tests__/MatchTable.test.tsx`, `BatchUpload.test.tsx`, extend `ScanPanel.test.tsx`

**Interfaces:**
- Consumes: the Task 6 API shapes.
- Produces: types `ScanMatch = {state: 'confident' | 'ambiguous' | 'none'; candidates: {id: string; name: string; sis_user_id: string | null; reason: 'id' | 'name' | 'partial'}[]; student_id_on_doc: string | null}`; `ScanRecord` gains `batch_id: number | null` and `match: ScanMatch | null`; `ScanBatch = {id: number; files: ScanRecord[]; counts: {reading: number; ready: number; failed: number; confirmed: number; applied: number; skipped: number}}`. `BatchUpload({accountId, onStarted(batch: ScanBatch)})`; `MatchTable({batch, accountId, pollMs?, onChange(batch), onReview()})`.

- [ ] **Step 1: Write failing Vitest specs (msw).**
  - BatchUpload: takes several files; refuses more than 25, a file over 20 MB, and a type that is not PDF/PNG/JPEG before sending anything, naming the file; posts `files[]` and `account_id`.
  - MatchTable: a table with column headers (File, Status, Name on the IEP, Student, Why, Actions); a row per file; status Reading, Ready, Failed (with Try again calling retry); the Student column is a picker of the candidates plus a `PersonPicker` search; a `confident` row is pre-selected; Confirm calls `PUT imports/:id/student`; Skip calls `DELETE imports/:id` after which the row shows Skipped; **Confirm all exact matches** confirms only `confident` rows and says how many; `ambiguous` and `none` rows are never confirmed by it; "12 of 25 read" progress is in a `role="status"` region and updates; polling continues while any file is Reading and **a failed poll keeps the table and tries again on the next tick**; **Review N scans** is disabled until at least one is confirmed.
  - ScanPanel: "One IEP" / "Several IEPs" switch; "One IEP" behaves exactly as before.
- [ ] **Step 2: Run `yarn test ui/features/supports`.** Expected: FAIL.
- [ ] **Step 3: Implement** in Material 1 using `ui.tsx` (`Card`, `button`, `flatButton`, `field`, `Status`, `muted`) and `PersonPicker`; the candidates picker is a native `<select>` labelled "Student for <file name>".
- [ ] **Step 4: Run Vitest, `npx biome check --write` on the new/changed files only, `yarn check:ts` (expected errors only in `admin_hub/HubApp.tsx`).** Expected: PASS.
- [ ] **Step 5: Commit; rebuild the frontend.**

---

### Task 8: Stage 2 UI, the rearranged review page

**Files:**
- Create: `ui/features/supports/react/ReviewWorkspace.tsx`
- Modify: `ui/features/supports/react/ScanPanel.tsx`, `ui/features/supports/react/ScanReview.tsx` (becomes the workspace's right column content, or is folded into `ReviewWorkspace` and removed), `ui/features/supports/react/__tests__/ScanPanel.test.tsx`; add `__tests__/ReviewWorkspace.test.tsx`

**Interfaces:**
- Consumes: Task 7 types; the existing review, apply, undo, retry and discard endpoints.
- Produces: `ReviewWorkspace({records: ScanRecord[], currentId: number, accountId, onSelect(id), onChange(record), onBack()})`. With one record the queue is hidden (the single-scan page).

- [ ] **Step 1: Write failing specs.**
  - Layout: on a wide window two columns, a left column with the queue and the summary (student, plan type and dates, mismatch warning) and a right column with the accommodation cards in a grid and the "Not mapped" notes; the queue lists each confirmed file with its student and a status (To review, Applied, Skipped) and marks the current one; a single scan shows no queue; on a narrow window the queue becomes a "3 of 12" stepper (assert the stepper text and that the queue list is not rendered).
  - Sticky bar: **Apply & next** applies the current scan and moves to the next To-review scan, **moving focus to that scan's heading** and announcing it in `role="status"`; on the last scan it says so and returns to the table; **Skip** deletes the scan's file and moves on; **Back to matches** returns to the table; Apply is blocked with the same reasons as before (problem items, unconfirmed name mismatch, no plan type).
  - Every behaviour the old `ScanPanel` tests covered still holds in the new layout: edit an item or the plan, keep a "Not mapped" note, mismatch acknowledgement, failed read with Try again, apply then Undo, discard, name shown ("Scan for <student>").
  - **Changing nothing for a scan after it is applied; skipping the only remaining scan; every scan skipped** all end in a sensible "Nothing left to review" state.
- [ ] **Step 2: Run `yarn test ui/features/supports`.** Expected: FAIL.
- [ ] **Step 3: Implement** the two-column CSS grid (`grid-template-columns: minmax(16rem, 20rem) 1fr`, collapsing below about 48rem), the sticky bottom bar, and the stepper; keep `ScanCard` as is.
- [ ] **Step 4: Run Vitest, biome on changed files only, `yarn check:ts`; resize check by reading the rendered styles in a test.** Expected: PASS.
- [ ] **Step 5: Commit; rebuild the frontend.**

---

### Task 9: End-to-end check and the eval

**Files:**
- Modify: `spec/evals/supports/iep_extractor_eval_spec.rb` (scoring reads `student_id`), `spec/fixtures/supports/synthetic_ieps/expected.yml`
- Test: the full supports Ruby and Vitest suites

**Interfaces:**
- Consumes: Tasks 1 to 8.

- [ ] **Step 1: Run the whole area:** `docker compose run --rm web bin/rspec spec/services/supports spec/controllers/supports spec/models/supports spec/migrations spec/evals` and `yarn test ui/features/supports ui/features/ai_settings`. Expected: all pass (the live eval part skips).
- [ ] **Step 2: Drive the real flow in the dev environment** through the Rails runner: create a batch of two synthetic IEPs for the admin user (one whose printed ID matches a dev student's SIS ID, one with no match), run the extraction with the stub extractor, and print the match states; do not send real student documents to the API.
- [ ] **Step 3: Hand off for the live check:** list for the user the steps to try a real batch in the browser, and note that the opt-in eval (`ANTHROPIC_EVAL=1`) now also checks the student ID.
- [ ] **Step 4: Commit.**

---

## Self-review notes

- Spec coverage: matching (1, 2, 3); data model (4); API and limits (5, 6); UI stage 1 (7), review page and queue (8); testing and the eval (9); the shared search refactor is in Task 2. The 7-day cleanup needs no task: it already discards unapplied previews by last activity, batch or not, and a batch with no scans left keeps only its empty record.
- One decision the spec left open: **case managers can now use the student search endpoint for their caseload** (Task 2), so the search box in the match table works for them. This widens the endpoint beyond the all-students managers; Task 2's tests pin that a teacher is still refused and a case manager sees only the caseload.
- Out of scope, as in the spec: ZIP upload, auto-apply, DOB matching, merging duplicates.
