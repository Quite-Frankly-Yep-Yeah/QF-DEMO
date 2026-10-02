# IEP bulk scan design (Phase 2)

Date: 2026-10-02
Builds on: `docs/superpowers/specs/2026-10-01-iep-scan-design.md` (the single-student scan, Phase 1) and
`docs/superpowers/specs/2026-10-02-anthropic-settings-design.md`.
Flag: `iep_scan` (no new flag).

## Purpose

Let a supports manager upload many IEPs at once, have each matched to a student, confirm the matches, and then review each
scan's proposed accommodations one after another. Nothing is attached to a student or applied without a person confirming.

Success: 25 IEPs go from upload to applied in one sitting; most rows match on their own and one click confirms the exact
ones; the person still reads each IEP's proposed accommodations before they are applied; a wrong student is easy to fix
before apply; a case manager can only match and apply for students on their caseload.

## Decisions recorded in this design

- **Review level (user, 2026-10-02):** two stages. Confirm matches in a table, then review each scan's accommodations in
  turn. No auto-apply.
- **Review page (user, 2026-10-02):** rearranged for batch work, and used for single scans too.
- **Batch size (design):** up to 25 files per batch, each up to 20 MB, and 200 MB in all.
- **Who (design):** anyone who may manage plans for some students in the school (`supports_manage_plans`). Candidates are
  limited to the students they may manage.

## Not in scope

ZIP uploads, auto-applying anything, matching by date of birth (users have none), merging duplicate scans for one student.

## Matching

`Supports::StudentMatcher.new(viewer, root_account).call(name:, student_id:) -> Match`.

- The extractor also reads a **student ID printed on the IEP** (`student_id` in its answer, nullable) beside the name.
- Candidates come from `Supports::StudentSearch`, the student-search rules now in `StudentsController#search` moved into a
  shared service, so the controller and the matcher cannot disagree: enrolled students, plus people with a login at the school
  and no staff role. For a viewer without the all-students permission, only students on their caseload
  (`Supports::Access#can_manage?`).
- Ranking: (1) a SIS user ID or login ID equal to the ID on the document, (2) a name equal as a set of words (order, case
  and punctuation ignored), (3) a partial name (one name's words are a subset of the other's). At most 5 candidates, each
  `{id, name, sis_user_id, reason: "id" | "name" | "partial"}`.
- State: `confident` when exactly one candidate matches by ID and the name does not point to someone else, or there is no
  ID and exactly one candidate matches by exact name. `ambiguous` when several candidates match, or the ID and the name
  disagree. `none` when there are no candidates. Only `confident` rows are eligible for "Confirm all exact matches".
- The match is stored in the encrypted `extraction` as `"match" => {"state", "candidates", "student_id_on_doc"}`. A student
  is attached only when a person confirms.

## Data model

- New table `support_scan_batches` (`Supports::ScanBatch`): `root_account_id`, `account_id`, `user_id`, timestamps. It holds
  no student data.
- `support_imports` gains a nullable `batch_id` (foreign key, partial index). `student_id` is already nullable: a batch
  scan has no student until it is confirmed. Imports with no student are visible only to the user who uploaded them.
- `Import` gains `matched?` (a student is attached) and the extraction's `match` is exposed in `as_api_json` as `match`.

## API

All under `/api/v1/supports`, all requiring the `iep_scan` flag:

- `POST scan_batches` (`account_id`, `files[]`): creates the batch and one queued scan per file (each read by the existing
  background job, no student needed). 25 files, 20 MB each (images 5 MB), 200 MB total, else 422. Returns the batch.
- `GET scan_batches/:id`: `{id, files: [...as_api_json of each import, with match...], counts: {reading, ready, failed,
  confirmed, applied, skipped}}`. Only the uploader may read it.
- `PUT imports/:id/student` (`student_id`): confirms or changes the student for a scan that is not yet applied. The student
  must be one the user may manage; any such student is accepted (not only the candidates). Rebuilds the preview, including
  the name-mismatch warning, against that student.
- `DELETE imports/:id` (existing): skips a scan, deleting its file. Allowed for the uploader when no student is attached.
- Review, apply, undo and retry (existing) refuse with 409 "Confirm the student first" while no student is attached.
- The existing single-scan `POST imports` is unchanged.

## UI (Material 1, in `ui/features/supports/react`)

- **Scan an IEP** gets a switch: "One IEP" (as today) or "Several IEPs".
- **Stage 1, Match students.** A table, one row per file: file name; status (Reading, Ready, Failed with Try again); the name
  on the document; the proposed student as a picker of the candidates plus a search box (`PersonPicker`); the reason
  ("SIS ID matches", "Name matches exactly", "Name matches 2 students", "No match"); and Confirm, Skip. A **Confirm all exact
  matches** button confirms every `confident` row at once. A progress line ("12 of 25 read") is announced as it changes. The
  table is polled while any file is still being read, and keeps its state through a failed poll.
- **Stage 2, Review** (also the single-scan page). On wide screens two columns: a left column with the batch queue (each
  confirmed file with its student and a status: To review, Applied, Skipped) above a summary of the current scan (student, plan
  type and dates, the name-mismatch warning); a right column with the accommodation cards in a grid and the "Not mapped"
  notes. A sticky bar holds **Apply & next**, **Skip** and **Back to matches**. On a phone the queue becomes a "3 of 12"
  stepper above the cards. A single scan shows the same page without the queue.
- Accessibility: the table has real headers; status and progress changes are announced; **Apply & next** moves focus to the
  next scan's heading; every control is reachable by keyboard.

## Errors and edge cases

- An unreadable, password-protected or refused file fails in its row with a plain message and Try again or Skip.
- Two files for one student are both allowed. The second review shows its changes against what the first applied.
- A file with no name or ID on it matches `none`; a person picks the student with the search box.
- The 7-day cleanup is unchanged and counts from last activity, so a batch worked through in a day is safe. A batch whose
  scans are all gone keeps only its empty record.

## Testing

- `StudentMatcher`: ID match, exact name, partial name, name and ID disagreeing, several matches, none, name order and case,
  caseload limits for a case manager, a student at another school never offered.
- `StudentSearch`: the controller's existing search specs keep passing after the move.
- Batch API: limits (count, size, type), permissions (uploader only, case manager scope, a student the user may not manage
  refused on confirm), confirming and changing a student, skipping, 409 before confirmation, counts.
- Extractor: the student ID is read from a synthetic IEP that prints one (a new eval fixture).
- UI (Vitest): the match table (rows, confirm, change, skip, confirm-all, polling and failed poll), the queue and
  Apply & next, the single-scan page without a queue, announcements, keyboard use.

## Open items

None.
