# Teacher workflow and student supports: discovery and build plan

Status: **revision 2 (2026-09-27): your §7 answers are folded in. Phase 0 is in progress.**
Date: 2026-09-26 (revision 1), 2026-09-27 (revision 2)

**What changed in revision 2:** a per-school record mode (classroom layer or system of record, Q1 and Q10), Michigan
deadline defaults (Q6), a choice of pacing accommodation (Q8), a MISTAR/Q-first import (Q13), a new Phase 13 for
system-of-record mode, and two privacy details settled in Phase 0 (assigned support caseloads and a school-wide
permission, §2.2).

This plan adds two connected sets of features on top of the self-paced platform (`docs/fork-plan.md`). Both are about
making a teacher's week easier and giving the school the tools it is expected to have.

- **Track S, Student supports:** the tools a school needs for students with a 504 plan, an IEP or an English-learner
  plan: who has which accommodations, making sure teachers know, making sure the accommodations happen, and keeping up
  with the deadlines, goals and service minutes that come with them.
- **Track W, Teacher workflow:** a grading queue that works across courses, follow-ups and a contact log, one page per
  student, and progress reports.

It covers:

1. what we found in the code that shapes the plan (§0),
2. what already exists that we reuse (§1),
3. what we build and how (§2, §3),
4. privacy and the legal points to confirm (§4),
5. a phased roadmap (§5), the riskiest assumptions (§6) and the questions I need you to answer (§7).

Paths are relative to the repo root. Line numbers are as of today's tree.

**About the legal parts.** I have written this for a U.S. school (IDEA, Section 504, FERPA). References to those laws are
for orientation. I am not a lawyer, and the rules and deadlines differ by state. Anything marked *confirm* needs the
school's compliance officer or counsel before it ships.

---

## 0. Findings that shape the plan

| # | Finding | What it means for us |
|---|---------|----------------------|
| F1 | **Canvas already has a per-student extra-time field on a quiz attempt.** `Quizzes::QuizSubmission#extra_time` (minutes, `app/models/quizzes/quiz_submission.rb:37`) is added to the attempt's deadline when it is computed (`app/models/quizzes/quiz.rb:725`). Today it is only set by hand, one quiz at a time, through the Moderate page (`app/models/quizzes/quiz_extension.rb`, capped at 10,080 minutes). | "Extended time" can be enforced by the system. The natural place is where an attempt is created (`Quizzes::Quiz#generate_submission`, `quiz.rb:750`). Getting it wrong is a compliance failure, so it needs the most careful tests (R3). |
| F2 | **Per-student due dates are already ours.** They are `AssignmentOverride` rows. The pacing engine writes and owns the ones titled "Self-paced plan" (`app/services/self_paced/due_date_writer.rb`). | An extended-deadline accommodation must go through the pacing plan (a factor on the target date), not write its own overrides that fight the engine. |
| F3 | **Nothing in the app knows about 504, IEP or EL.** There is no plan, case manager or accommodation concept, and no mention in the code or docs. Canvas's old faculty journal (`UserNote`) is not in this tree. Our staff notes (`app/models/self_paced/student_note.rb`) are free text for anyone with the notes permission. | This is new ground. Free-text notes are too loose a container for protected information. |
| F4 | **Our mentor access is deliberately wide.** A Mentor sees every student in the school's self-paced courses (decision 2 in `docs/fork-plan.md`). | Special-education records need a much narrower rule: "need to know". The new data gets its own permission tiers and does not ride on the mentor role (§2.2). |
| F5 | **Teachers already have most of the raw material for a grading queue, but only per course.** `Submission.needs_grading` (`app/models/submission.rb:455`) and per-course counts exist. There is no view across courses, and no idea of which grading is holding a student up. Our provisional mode lets a student move on while a check waits for a grade, and a late failing grade re-locks them (`app/services/self_paced/gating.rb`). | The queue's value is ranking: grade first the work that is holding students back. Only our data knows that. |
| F6 | **Comment banks exist in the grader** (`app/models/comment_bank_item.rb`). Custom gradebook statuses (`custom_grade_status.rb`), late policies (`late_policy.rb`), Scheduler appointments (`appointment_group.rb`) and personal planner notes (`planner_note.rb`) also exist. | We reuse the comment bank instead of building one. Planner notes are personal and not tied to students, so follow-ups still need their own table. |
| F7 | **Messaging is one-way in our tools.** Interventions can send a Conversations message (`app/services/self_paced/intervener.rb`). Nothing records a phone call, a meeting or "call back Friday". | The contact log and follow-ups (Phase 4) fill a real gap, and both feed the student page (Phase 6). |
| F8 | **Reports are five CSVs and the observer view.** `SelfPaced::Reports::KINDS` (`app/services/self_paced/reports.rb:27`) has progress, time on task, pacing, interventions and engaged days. There is no report card or progress report. | Progress reports (Phases 7 and 8) are a new output. The IEP progress report and the general one share the same engine. |
| F9 | **The role, notification and alert plumbing is reusable.** `MentorRole.ensure_role!` (`app/services/self_paced/mentor_role.rb`) makes account roles from a permission list. New notification types are one migration (`db/migrate/20260924150002_add_self_paced_alert_notification.rb`). `AlertEvaluator` shows the pattern for a recurring job that raises things and notifies people. | Case Manager and Support Staff roles, deadline reminders and the compliance checks all follow patterns we already have. |
| F10 | **Canvas records changes and logins, not reads.** To my reading, its auditors log grade changes, course changes and authentication, but not who opened a record. *Confirm in Phase 0.* | We need our own append-only access log for protected records (§2.2). |
| F11 | **Files need a home.** A Canvas attachment belongs to a course, user, group or account, and most of those are visible to more people than a special-education document should be. | Storing documents needs its own locked-down design. So the first version stores no documents (Q10). |

---

## 1. What we reuse

| Existing piece | Where | How the new work uses it |
|---|---|---|
| Mentor role and caseloads | `mentor_caseloads`, `SelfPaced::MentorRole` | Model for the new roles. Caseloads decide which students a support person "owns". |
| Interventions log | `interventions` (append-only, real actor recorded) | Phase 2 exemptions and extra attempts go through `Intervener`, so they are logged and permission-checked the same way. |
| Alerts and the evaluator job | `alert_rules`, `self_paced_alerts`, `AlertEvaluator` | Deadline reminders and grading-backlog alerts are new rule kinds on the same machinery. |
| Pacing engine | `SelfPaced::Pacer`, `PlanBuilder`, `DueDateWriter` | An accommodation factor is one more input to the plan (§2.3). |
| Retake and quiz rules | `SelfPaced::RetakeRules`, `Quizzes::QuizEligibility` | Extra attempts, and extended time, fit the same eligibility path. |
| Student page pieces | `StudentDetail`, `StaffHome`, roster filters, bulk `Progress` jobs | The student page (Phase 6) assembles these. Bulk jobs run the same way. |
| Observer (parent) view | `ObserverView`, link requests | Parents get progress reports and, later, plan summaries through it (Phases 8 and 11). |
| Notifications | `Canvas::MessageHelper.create_notification`, `app/messages/*` | Deadline and task reminders. |
| Permissions registry and flag file | `config/initializers/permissions_registry.rb`, `config/feature_flags/self_paced.yml` | Same pattern for the new permissions and flags (§3.4). |
| Comment bank | `CommentBankItem` | Grading and progress-report comments. |

---

## 2. What we build and how

### 2.1 Scope: a classroom layer, not the legal record

The hardest question in Track S is what the app *is*. Most districts already keep the IEP itself in a special-education
system (Frontline, SEIS, PowerSchool Special Programs and similar). The IEP is a legal document: state forms, meeting
notices, e-signatures, amendments and version history. Rebuilding that would be a large project and a compliance risk.

**Recommendation:** the app is the **classroom-facing layer** on top of the district's system of record. It holds:

- a plan's identity and dates (type, status, case manager, review dates),
- the accommodations in plain teacher-facing language,
- goals, progress data and service logs (the parts teachers and providers produce every week),
- deadlines and reminders,
- imports from the district's system by CSV, so nobody types the same thing twice.

It does **not** author IEP or 504 documents, collect signatures, or store evaluation results.

**Record mode (revision 2).** You want both, chosen per school. An inheritable account setting, `supports_record_mode`,
is `classroom_layer` (the default) or `system_of_record`. Everything through Phase 12 works the same in both modes.
System-of-record mode adds, behind its own flag in Phase 13: authoring plans in the app, a version for every change,
e-signatures, meeting notices and the locked-down document vault (tier 3, Q10). A classroom-layer school keeps
importing from its district system and never sees those screens.

### 2.2 Privacy model: three tiers, and a log

The rule for everything in Track S is **need to know**.

| Tier | What it holds | Who sees it (default) |
|---|---|---|
| **1. Accommodations** | The list of accommodations that apply to a student, with dates and teacher-facing instructions ("1.5x time on tests", "chunk directions"). **No** disability category, eligibility, evaluation results or goals. | Teachers and TAs enrolled in the student's courses, the case manager, support staff, admins with the permission. Not school-wide mentors unless the student is on their caseload (Q4). |
| **2. Plan details** | Plan type and status, dates, case manager, meetings, goals, progress data, services and session logs. | Case managers, support staff and admins with the permission. Not teachers of record. |
| **3. Documents and evaluation information** | Only if we ever store them (Q10). | Case managers and admins with the permission. |

- **IDEA requires teachers to be told** what they are responsible for (34 CFR 300.323(d): each teacher and service
  provider responsible for implementing the IEP must know their specific responsibilities and the specific accommodations).
  Tier 1 is that, and only that. *Confirm.*
- **Students and parents** do not see tier data in the first phases. Parents get a summary and progress reports later
  (Phase 11).
- **New permissions** (in `permissions_registry.rb`, account level): `supports_view_accommodations`,
  `supports_view_plans`, `supports_manage_plans`, `supports_manage_catalog`, `supports_log_services`,
  `supports_view_access_log`.
- **School-wide scope is its own permission (revision 2):** `supports_view_all_students`. Admins hold it by default. A
  support permission without it only reaches the students **assigned** to that person.
- **Assigned support caseloads (revision 2):** a new `support_caseloads` table, managed by people with
  `supports_manage_plans`. It is separate from the mentor pin list, because anyone who can see the dashboard can pin
  any student there, and pinning must not unlock protected data. Q4's "mentors see accommodations for their caseload"
  means this assigned caseload.
- **New roles**, made like `MentorRole`: **Case Manager** (tiers 1 and 2, manage plans and services for their caseload) and
  **Support Staff** (counselor, psychologist, related-service provider: tier 1, and tier 2 for their students).
- **Access log.** A new append-only table, `support_access_logs`: viewer, real user when masquerading, student, tier, what
  was opened, when. It records reads as well as changes (F10). To keep the volume small, repeat views by the same person of
  the same student inside one hour are one row.
  - IDEA and FERPA require a record of access for **outside parties**. Logging internal views is not strictly required
    by those rules, but it is the cheapest way to show need to know, and many districts require it. *Confirm the policy.*
  - A read-only "who looked at this student" view is for the compliance officer.
- **Messages never carry tier data.** Notifications and emails say "A support plan update is waiting for you", not what the
  accommodation is. This is enforced in the templates and by a spec.
- **No diagnosis field.** Plan type is a choice (IEP, 504, EL, other). There is no free-text field for a disability.
- **Retention.** Same rule as the rest of our data: kept until the student's user record is deleted, then purged. Merges
  move the rows. Special-education retention often has its own state rule after a student leaves. *Confirm (Q9).*
- **Masquerading** is logged with the real user, and a masquerading student sees no tier data.
- **Encryption of stored text.** Rails can encrypt attribute values in the database. We should use it for free-text
  fields in tiers 2 and 3. To evaluate in Phase 0.

### 2.3 Accommodations: how the system acts on them

The accommodation catalogue is the school's own list. Each item has a kind, and each kind says **how the app applies it**:

| Kind of accommodation | How it is applied | Level |
|---|---|---|
| Extended time on timed assessments (multiplier or fixed minutes) | Sets the attempt's `extra_time` when the attempt is created (F1). Shown on the quiz's Moderate page as coming from a plan. Never reduces an existing extension. | **Enforced** |
| Extended deadlines / flexible pacing | A factor on the student's pacing plan. The case manager chooses, per student (Q8): move the finish date out by a percentage, or lower the daily target and keep the finish date. `DueDateWriter` writes the new dates either way (F2). | **Enforced** |
| Extra attempts | The same route as an intervention: `QuizExtension` `extra_attempts`. | **Enforced** |
| Reduced or modified workload | A teacher chooses which items are exempt for this student. Uses the existing exempt override, with the reason "accommodation", so pacing recomputes. | **Assisted** (a teacher decides) |
| Frequent check-ins | A repeating follow-up task for the teacher or case manager (Phase 4). | **Assisted** |
| Display settings (dyslexic font, high contrast, reduced motion) | Sets the student's own display preference when the plan starts. They can change it. *Check how these settings are stored in Phase 2.* | **Enforced** (suggestion) |
| Read-aloud, scribe, calculator, word bank, chunked directions, alternate formats, and anything else | Shown to the teacher in the student's accommodation card. The app cannot do it for them. | **Informational** |

Each accommodation on a student has: the catalogue item, parameters, effective dates, the courses it applies to (all or
some), a source (IEP, 504, EL, other: not the plan's details), a teacher-facing note, and a "last verified" date.

**Teacher at-a-glance.** A card in the student drill-down and a small badge on the roster (a dot, never the word "IEP") show
the active accommodations. A teacher acknowledges the list once per plan version ("I have read this"). The acknowledgement is
logged, and case managers see who has not.

### 2.4 Deadlines and compliance calendar

Rules are **data, not code**, because they differ by state and district. The plan ships **Michigan** defaults (Q6, from
the Michigan Administrative Rules for Special Education, MARSE), each still marked *confirm*:

| Deadline | Default (federal orientation) | Notes |
|---|---|---|
| IEP annual review | within 365 days of the last IEP meeting | |
| IEP re-evaluation | within 3 years of the last evaluation | Can be waived by agreement, so it is editable per student. |
| 504 periodic review | annually, re-evaluation about every 3 years | Districts set their own. |
| Initial evaluation and IEP | within 30 school days of receiving parent consent (MARSE R 340.1721b) | Counts school days, so it needs the school calendar (`SchoolCalendar`). |
| Progress report | as the IEP says, at least as often as report cards | |
| Transition plan | in effect by age 16 | |

- A daily job (same pattern as `AlertEvaluator`) raises "coming up in 60/30/7 days" and "overdue" items, notifies the case
  manager, and escalates overdue ones to an admin.
- A **compliance dashboard** for case managers and admins: due soon, overdue, and plans with no case manager.
- **Meetings**: date, purpose, participants, notice sent, outcome. Parent notice goes out as a Conversations message with no
  tier data in it.
- The app is **not authoritative** for legal deadlines. The district's system is. The dashboard says so on the page.

### 2.5 Goals and progress monitoring

- A **goal**: area, statement, baseline, target, how it is measured, how often, who is responsible.
- **Data points**: date, value or observation, who recorded it, source.
- A chart with an aim line. Goals can be **aligned to a course skill** (we already have skills, `SelfPaced::Skills`), so
  progress data comes in automatically for goals that a course can measure.
- An **IEP progress report** each period: goal, data, a rating (for example "sufficient progress"), and a teacher comment.
  It is produced by the shared report engine in Phase 8, and released to parents only when the case manager approves it.

### 2.6 Services and minutes

- A **service**: type (specialized instruction, speech, OT, counseling, other), provider, minutes per week, dates.
- **Sessions**: date, minutes, delivered, missed or made up, a reason, a short note.
- **Compliance**: minutes delivered against minutes required for a week, month or the year, with make-ups counted.
- A **report** for providers and case managers, exportable as CSV. Billing exports (for example Medicaid) are out of scope.

### 2.7 MTSS / RTI and referrals

- An **MTSS plan**: tier, target skill, intervention, how often, how long, and progress data. It reuses the interventions log.
- A **referral** workflow: referred → screening → evaluation → decision (plan, no plan, or more data). Each step has a date
  and a deadline from §2.4.
- **A design rule from the law:** an intervention cannot be used to delay an evaluation a parent has asked for. The workflow
  lets a parent request start the evaluation clock regardless of the MTSS stage. *Confirm.*

### 2.8 Teacher workflow (Track W)

- **Grading queue.** One page for the grading a teacher can do, across all their courses, ranked with a plain reason on each
  row:
  - a student moved on with a provisional pass and the grade could still re-lock them,
  - a student is stuck waiting,
  - a due date is close, or the work has waited longest,
  - an accommodation applies (for example a time extension).

  Filters by course, unit and student. Each row opens the real SpeedGrader. We do not build a new grader. A "grading
  turnaround" number per teacher and course, and a `grading_backlog` alert kind for admins.
- **Follow-ups and contact log.**
  - **Tasks** (`staff_tasks`): tied to a student, an owner, a due date and a source (alert, intervention, deadline,
    accommodation check-in, manual). A "My follow-ups" list on the Students page, and reminders.
  - **Contacts** (`contact_logs`): call, email, text, meeting or other; who, when, outcome, notes, and an optional follow-up
    task. Messages sent from the dashboard log themselves.
  - **Templates** for messages, using the same placeholders as the rest of the app.
- **Student page.** One page per student: progress and pacing, alerts, interventions, notes, contacts and tasks, attendance,
  linked parents, and (only if the viewer's tier allows it) accommodations. A one-page printable **conference sheet** for
  parent meetings.
- **Progress reports.** Templates by period. Each student's report shows progress, pace, posted grades, time, attendance and a
  teacher comment (from a comment bank). Generated in bulk as a `Progress` job into a print-ready page (like the parent
  flyer, one student per page), and released to parents through the observer view.
- **Groups and office hours** (optional, last). Saved student lists a teacher can message or act on in bulk, and a simpler
  front end over Canvas's Scheduler for office-hour slots.

---

## 3. Architecture

### 3.1 Code layout

- Track S: `app/{models,services,controllers}/supports/…`, UI in `ui/features/supports_*`.
- Track W: `app/{models,services,controllers}/workflow/…`, UI in `ui/features/workflow_*`, with the student page and queue
  under the existing Students area of the nav.
- Same conventions as before: AGPL headers credited to "quite frankly an example LMS contributors", bundles registered in
  `ui/featureBundles.ts`, tests beside the code, nothing added to core unless the design needs it (§3.2).

### 3.2 Core code we'll change

- `Quizzes::Quiz#generate_submission` and the extra-time path (Phase 2), guarded so nothing changes for a student with no
  accommodation, with a before/after query count in the spec.
- The pacing plan builder (Phase 2), to read the accommodation factor.
- The permissions registry, the account tab list (Support and Grading entries) and the admin hub, as we did for Parents.

### 3.3 New tables

All have `root_account_id` and a replica identity index, as before.

- **Track S:** `support_plans`, `accommodation_types` (the catalogue), `student_accommodations`,
  `accommodation_acknowledgements`, `support_access_logs`, `support_deadline_rules`, `support_deadlines`, `support_meetings`,
  `support_goals`, `goal_data_points`, `support_services`, `service_sessions`, `mtss_plans`, `referrals`.
- **Track W:** `staff_tasks`, `contact_logs`, `message_templates`, `progress_report_templates`, `progress_reports`,
  `report_comments`, `staff_student_lists` (not called "groups", to avoid Canvas's Group).

### 3.4 Feature flags (`config/feature_flags/teacher_workflow.yml`)

Each phase ships behind its own flag. The two umbrella flags are separate, so a school can adopt one track without the other.

| Flag | Applies to | Gates |
|---|---|---|
| `student_supports` | RootAccount | Umbrella for Track S |
| `supports_plans` | Account | Plans, catalogue, accommodations card, import (Phase 1) |
| `supports_accommodations_apply` | Account | Extended time, pacing factor, extra attempts (Phase 2) |
| `supports_deadlines` | Account | Deadlines, meetings, compliance dashboard (Phase 5) |
| `supports_goals` | Account | Goals, progress monitoring, IEP progress reports (Phase 7) |
| `supports_services` | Account | Services and minutes (Phase 9) |
| `supports_mtss` | Account | MTSS/RTI and referrals (Phase 10) |
| `supports_parent_view` | Account | Parent plan summary, records export (Phase 11) |
| `teacher_workflow` | RootAccount | Umbrella for Track W |
| `workflow_grading_queue` | Account | Grading queue (Phase 3) |
| `workflow_followups` | Account | Tasks, contact log, templates (Phase 4) |
| `workflow_student_profile` | Account | Student page and conference sheet (Phase 6) |
| `workflow_progress_reports` | Account | Progress reports and comment bank (Phase 8) |
| `workflow_groups` | Account | Saved lists and office hours (Phase 12) |

### 3.5 Performance

- **Grading queue:** built from indexed submission scopes for the courses a teacher can grade, capped and paged. Ranking uses
  the existing `student_course_states` read model, not per-student queries. Cached for a short time per teacher.
- **Access log:** one insert per (viewer, student, hour), on a small indexed table, written after the response.
- **Deadlines:** a nightly job, not computed on page load.
- **Roster badge:** one query per page for the students on it, only for viewers who hold the tier-1 permission.
- **Bulk reports:** `Progress` jobs, one student at a time, no long transactions.

---

## 4. Privacy and legal points to confirm

Written so you can hand this section to the school's compliance officer.

1. **"Legitimate educational interest."** Who at the school may see tier 1 and tier 2? The defaults in §2.2 are a proposal.
2. **Access records.** IDEA and FERPA require a record of access by outside parties. We log internal reads too. Confirm the
   policy and how long logs are kept.
3. **Teacher notification.** Confirm tier 1 covers what the school must tell each teacher (34 CFR 300.323(d)).
4. **Parent rights.** Parents may inspect their child's records and ask for amendments. Phase 11 adds a records export. Confirm
   what the school wants parents to see in the app and what goes through the district's system.
5. **Retention.** Confirm the state rule for special-education records after a student leaves.
6. **Timelines.** State evaluation and reporting deadlines differ. The rules in §2.4 are editable data, and the school
   must confirm them before turning reminders on.
7. **Email and notification content.** Never includes plan or accommodation details. Confirm it is acceptable to mention that
   "a support plan update is waiting".
8. **Hosting and vendors.** Special-education records are the most sensitive data the app will hold. Confirm the hosting and
   any vendor agreements cover it.
9. **Test data.** Development and demo databases use fictional students only. No real records are ever entered in dev.

---

## 5. Phased roadmap

Every phase ends with passing RSpec and JS tests, a browser check of the real flow (like the parent flyer), and a short "what
changed / how to try it" note. Sizes are relative: S is about a day of work, M a few days, L about a week or more.

**Phase 0: Foundations and the privacy model** (S–M). Flags: `student_supports`, `teacher_workflow`.
- Flag file, permissions, the Case Manager and Support Staff roles, and the access-log table with its writer.
- Spikes (each answers a question before we build on it):
  1. the `generate_submission` hook for extended time across every attempt path (F1),
  2. an accommodation factor in the pacing plan without fighting `DueDateWriter` (F2),
  3. encrypted text columns,
  4. how display preferences are stored (§2.3).
- Done when: a spec shows tier-1 and tier-2 checks work for every role, and every read writes one log row.

**Phase 0 status (2026-09-27): built.**

- Flags `student_supports` and `teacher_workflow` (`config/feature_flags/teacher_workflow.yml`), the seven permissions,
  the `supports_record_mode` account setting, `Supports::Roles` (Case Manager, Support Staff), `support_caseloads`,
  the append-only `support_access_logs` with one row per viewer, record and hour, and `Supports::Access`, which decides
  the tiers and logs every allowed read. Retention and merges are in `Supports::UserData`.
- Specs: a role-by-tier matrix (teacher, TA, other teacher, case manager assigned or not, support staff, mentor assigned
  or only pinned, school admin, another school's admin, the student, their parent, flag off), logging, masquerading and
  merges.

**Spike results.**

1. **Extended time (F1).** Every way of starting an attempt goes through `Quizzes::Quiz#generate_submission`, then
   `build_submission_end_at`, which adds `QuizSubmission#extra_time`. That covers the student's quiz page, the
   `user_code` path in `QuizzesController`, and the API's `QuizSubmissionService#create`. The same submission row is reused
   for retakes, so `extra_time` carries over. **Hook:** in `generate_submission`, just before `end_at` is built, set
   `extra_time` to the larger of what is there and what the accommodation gives. Three catches for Phase 2:
   - The quiz's lock date and the enrollment's end date still cut `end_at` short, so an accommodation can be shortened by
     the availability window. Phase 2 must at least warn the teacher. *Decision needed then.*
   - The Moderate page overwrites `extra_time` with what the teacher types. It must show the accommodation as a floor.
   - Untimed quizzes ignore `extra_time`, which matches Q7.
2. **Pacing factor (F2, Q8).** `PlanBuilder.spread` is a pure function. The dates come from `Pacer#default_target_date`
   and `#days_between`.
   - *Extend the finish date:* add the percentage of the student's school days to the default target date. A date a
     teacher set by hand still wins.
   - *Lower the daily target:* keep the date and scale the expected-progress curve down in `Pacer#status`. The student
     then shows a projected finish after the target date.
   - Either way `DueDateWriter` stays the only writer of dates. `Pacer` will ask `Supports` for the student's pacing
     accommodation.
3. **Encrypted text.** Rails attribute encryption is not configured: the app has no Rails credentials. It does have
   Canvas's own encryption key (`security.yml`, used by `CanvasSecurity`). **Plan:** an initializer in Phase 1 derives the
   Rails encryption keys from that key, and tier 2 and 3 free text uses `encrypts`. Encrypted fields can't be searched,
   and rotating the Canvas key needs a re-encryption step.
4. **Display preferences.** High contrast and the dyslexia-friendly font are per-user feature flags
   (`User#prefers_high_contrast?`, `#prefers_dyslexic_font?`), so Phase 2 can switch them on for the student and the
   student can switch them off. There is **no reduced-motion setting** in the app; it would need a new preference.

**Phase 1: Plans, accommodations and the teacher at-a-glance** (L). Flag: `supports_plans`.
- The catalogue admin page, plan and accommodation editing for case managers, effective dates, "last verified".
- **CSV import** from the district's system, with a preview and a diff, so nothing is silently overwritten. It matches
  **MISTAR/Q's export** first (Q13), once we have a sample file from the district, and accepts a documented generic CSV.
  There is no public MISTAR/Q demo data, so development uses fictional students in the generic format.
- The accommodation card in the student drill-down, the roster badge, and teacher acknowledgement with its log.
- A caseload view for case managers.
- Done when: a teacher of a student sees the accommodations and nothing else, a mentor off the caseload sees nothing, and an
  import can be undone.

**Phase 1 status (2026-09-27): built.**

- Tables `support_plans`, `accommodation_types`, `student_accommodations`, `accommodation_acknowledgements` and
  `support_imports`. Plan notes, teacher notes, the uploaded CSV and an import's undo record are encrypted, with Rails keys
  derived from Canvas's key (`config/initializers/supports_encryption.rb`).
- The Supports page (`/supports`, an account menu item for people who work on plans): the caseload, each student's plans,
  accommodations and support team, which teachers have read the current list, the catalog, and CSV import with preview,
  apply and undo. A school starts with a 14-item catalog.
- For teachers: an accommodations card in the Students page tray (only the classes they teach, never the plan type) with
  "I have read these accommodations", and a dot on the roster. A change to the accommodations asks teachers again.
- Checked in a browser with a fictional student, on desktop and phone.
- Setup note: in dev, turning on a hidden flag from a Rails console can leave a cached copy of the root account with the
  old flag list. `Account.invalidate_cache(id)` and touching the account fix it.

**Phase 2: Accommodations that act** (L). Flag: `supports_accommodations_apply`. *Riskiest phase (R3, R4).*
- Extended time set at attempt creation; the Moderate page shows the source. Extra attempts. Pacing factor. Exemption
  workflow with the reason "accommodation". Display-setting suggestions.
- Each application is written to an audit row, and a case manager can see "what was applied to this student this week".
- Done when: a spec matrix covers first attempt, retake, moderated quiz, timer auto-submit off, and a student with no
  accommodation is byte-for-byte unaffected.

**Phase 3: Grading queue** (M). Flag: `workflow_grading_queue`. No privacy dependency.
- The ranked queue across courses, filters, SpeedGrader deep links, turnaround numbers, and the `grading_backlog` alert kind.
- Done when: the top of the queue is the work holding students back, checked against a 300-student test course.

**Phase 4: Follow-ups and contact log** (M). Flag: `workflow_followups`.
- Tasks, "My follow-ups", reminders through a new notification, the contact log, message templates, and auto-logging of
  messages sent from the dashboard.
- Done when: an alert or an accommodation check-in can create a task in one click.

**Phase 5: Deadlines, meetings and the compliance dashboard** (M–L). Flag: `supports_deadlines`.
- Editable rules with defaults, the daily job, reminders, escalation, meetings and parent notices, the dashboard.
- Done when: a test clock proves 60/30/7-day and overdue reminders fire once each, and no message contains tier data.

**Phase 6: Student page and conference sheet** (M). Flag: `workflow_student_profile`.
- One page per student assembling everything the viewer's tier allows, plus the printable one-page sheet.
- Done when: the same page shows different sections to a teacher, a case manager and a mentor, and the log records each.

**Phase 7: Goals, progress monitoring and IEP progress reports** (L). Flag: `supports_goals`.
- Goals, data points, charts, skill alignment, and progress reports for case manager approval.
- Done when: a goal aligned to a skill fills in its own data.

**Phase 8: Progress reports and comment banks for every student** (M). Flag: `workflow_progress_reports`.
- Templates, bulk generation into print-ready pages, comment bank, release to parents through the observer view.
- Shares the engine with Phase 7. Done when: a class of 30 generates in one job and a parent sees only their own child's.

**Phase 9: Services and minutes** (M). Flag: `supports_services`.
- Services, session logging (fast on a phone), compliance numbers, provider and case-manager reports, CSV export.

**Phase 10: MTSS/RTI and referrals** (M–L). Flag: `supports_mtss`.
- Tiered plans with progress monitoring, the referral workflow with deadlines, and the parent-request rule from §2.7.

**Phase 11: Parent view, records export and documents** (M–L). Flag: `supports_parent_view`.
- A parent-facing summary (accommodations and released progress reports), a "records for this student" export for inspection
  requests, and, only if you choose it (Q10), a locked-down document vault.

**Phase 12: Groups and office hours** (M, optional). Flag: `workflow_groups`.

**Phase 13: System-of-record mode** (L+, revision 2). Flag: `supports_system_of_record`. Only for schools whose
`supports_record_mode` is `system_of_record`.
- Plan authoring in the app, a version for every change with who and when, e-signatures, meeting notices, and the
  locked-down document vault (tier 3).
- Needs the school's forms and its compliance officer's sign-off before it ships (§4).

**Order.** The order is data model → things that act → daily tools → depth. Track S starts first because the privacy design
takes the longest to review and everything in it depends on Phases 0 and 1. Phases 3 and 4 have no privacy dependency, so they
can move ahead of Phase 2 if you want teachers to see improvements sooner (Q12).

---

## 6. Riskiest assumptions

| # | Assumption | Risk | How we reduce it |
|---|---|---|---|
| R1 | Supporting both record modes | **High.** System-of-record mode is several times bigger than the classroom layer. | Revision 2 builds the classroom layer first. System-of-record mode is Phase 13, behind its own flag, and the data model from Phase 1 carries a version and a source on every plan so the two modes share it. |
| R2 | The tier rules match the school's "need to know" policy | Policy risk. | Tier 1 is only what a teacher is entitled to know. The school confirms before rollout (§4). |
| R3 | **Extended time is applied correctly in every quiz path** | **High.** Too little time is an accommodation failure with legal weight. | Only ever add, never reduce. A spec matrix over every attempt path. The source shows on the Moderate page. Every application is logged. A preview shows the teacher what the student will get. |
| R4 | A pacing factor and the due-date engine don't fight | Medium. The engine rewrites dates daily (R10 in `fork-plan.md`). | Phase 0 spike. The factor is an input to the plan, so there is one writer of dates. |
| R5 | Accommodation data stays accurate | Medium. A lapsed or wrong accommodation reaching a teacher is a real harm. | Effective dates, "last verified", expiry reminders, and an import that shows a diff before it changes anything. |
| R6 | Deadline reminders are trusted | **High-consequence.** A missed legal deadline is a compliance failure. | The dashboard says the district system is authoritative. Overdue items escalate. Reminders are tested with a fake clock. |
| R7 | Notifications don't leak tier data | Medium. | Templates never take plan fields, and a spec checks every template. |
| R8 | Teachers will use it | Medium. A tool that takes many clicks gets skipped. | Phases 3 and 4 are built for speed first. We measure clicks to "graded" and "followed up" in the browser checks. |
| R9 | Thirteen phases get finished | Medium. Half-built features are worse than none. | Every phase ships alone behind its own flag. There are deliberate stopping points after Phases 1, 2, 4 and 6. |
| R10 | Testing without real data | Low, but easy to get wrong. | Fictional students only, and a rule against real records in dev (§4). |
| R11 | Security fixes keep arriving | High, ongoing (R8 in `fork-plan.md`). | This project makes it more important: the app will hold more sensitive data. |

---

## 7. Questions for you (answered 2026-09-27)

Your answers are in the "Answer" column. "What we'll do" is updated to match.

| # | Question | Answer | What we'll do |
|---|---|---|---|
| Q1 | Is the app the school's **system of record** for IEP/504 documents, or a **classroom layer** fed from the district's system? | "Both, with an option to switch between each." Switch: **per school setting.** | An account setting picks the mode. The **classroom layer is built first** (CSV import, §2.1). System-of-record features (authoring, versions, signatures, the document vault) come in later phases behind their own flags. **Needs a plan revision** (§2.1, §5, R1). |
| Q2 | Which programs to cover? | IEP, 504 and EL. | **IEP, 504 and EL** as plan types in Phase 1. MTSS in Phase 10. Health plans, GT and foster/homeless flags are left out. |
| Q3 | Who is a case manager, and who else may see plan details (tier 2)? | Case managers plus support staff. | Case Manager role, plus Support Staff (counselor, psychologist, providers) for their own students. Mentors and teachers of record do not. |
| Q4 | May school-wide **mentors** see accommodations? | Caseload only. | **Only for students on their caseload.** |
| Q5 | May students see their own accommodations? | No; parents later. | **No** in the first phases. Parents get a summary in Phase 11. |
| Q6 | Which state's rules? | **Michigan.** | Configurable rules with **Michigan's timelines** (MARSE) as the defaults, each still marked *confirm* until the school checks them. |
| Q7 | Extended time: a multiplier, or fixed minutes? On untimed quizzes? | Multiplier or minutes. | **A multiplier or fixed minutes per accommodation, timed quizzes only,** applied when the attempt starts, and never reducing what a teacher set. |
| Q8 | For self-paced pacing, extend the finish date or lower the daily target? | **Case manager chooses.** | Both options exist; the case manager picks one per student's accommodation (extend the finish date by a percentage, or lower the daily target). |
| Q9 | Retention of support records? | Until the user is deleted. | **Until the student is deleted** (like everything else), plus an "archived" state. Purge rules per state later. |
| Q10 | Should the app store **documents**? | "An option to do either." | Follows the Q1 mode setting: classroom-layer schools link to the district system; system-of-record schools get the locked-down document vault (tier 3). |
| Q11 | Should the grading queue cover all courses or only self-paced ones? | All courses. | **All the courses a teacher grades**, with the self-paced ranking signals where they exist. |
| Q12 | Do you want the order in §5, or teacher-workflow wins (Phases 3 and 4) first? | As written. | **§5 as written.** |
| Q13 | Is there a pilot school or teacher group, and is there a district system I should match the import format to? | "It will eventually be mostly **MISTAR/Q**, but I don't have demo data." | The import targets **MISTAR/Q's export format** where it can be found, with the generic CSV as the fallback. Development uses fictional demo data only. |
| Q14 | Does the school or state require contact logs in a specific form? | General log. | **A general log** (§2.8). |

---|---|---|
| Q1 | Is the app the school's **system of record** for IEP/504 documents, or a **classroom layer** fed from the district's system? | **Classroom layer**, with CSV import (§2.1). |
| Q2 | Which programs to cover? | **IEP, 504 and EL** as plan types in Phase 1. MTSS in Phase 10. Health plans, GT and foster/homeless flags are left out. |
| Q3 | Who is a case manager, and who else may see plan details (tier 2)? | Case Manager role, plus Support Staff (counselor, psychologist, providers) for their own students. Mentors and teachers of record do not. |
| Q4 | May school-wide **mentors** see accommodations? | **Only for students on their caseload.** |
| Q5 | May students see their own accommodations? | **No** in the first phases. Parents get a summary in Phase 11. |
| Q6 | Which state's rules? | Configurable rules, with **federal defaults marked "confirm"**. Tell me the state and I'll fill in its numbers. |
| Q7 | Extended time: a multiplier, or fixed minutes? On untimed quizzes? | **A multiplier or fixed minutes per accommodation, timed quizzes only,** applied when the attempt starts, and never reducing what a teacher set. |
| Q8 | For self-paced pacing, extend the finish date or lower the daily target? | **Extend the finish date** by the plan's percentage. Daily minutes stay the same. |
| Q9 | Retention of support records? | **Until the student is deleted** (like everything else), plus an "archived" state. Purge rules per state later. |
| Q10 | Should the app store **documents**? | **No** in v1. Link to the district's system. A vault is optional in Phase 11. |
| Q11 | Should the grading queue cover all courses or only self-paced ones? | **All the courses a teacher grades**, with the self-paced ranking signals where they exist. |
| Q12 | Do you want the order in §5, or teacher-workflow wins (Phases 3 and 4) first? | **§5 as written**, unless you say otherwise. |
| Q13 | Is there a pilot school or teacher group, and is there a district system I should match the import format to? | **Demo data only.** The import takes a documented generic CSV. |
| Q14 | Does the school or state require contact logs in a specific form? | **A general log** (§2.8). |

---

## 8. Not in this plan

Deliberately left out. Any of these could be a later project.

- **Authoring IEP or 504 documents**, e-signatures, meeting-notice forms (§2.1).
- **Billing** for services (Medicaid and similar).
- **Behavior and discipline tracking** (PBIS, referrals, incident reports).
- **Health plans** and other non-instructional records.
- **Gradebook or SpeedGrader redesign.** We link to them.
- **Transcripts, graduation audits, credit recovery.**
- **Substitute or coverage handoff** for mentors and teachers.
- **SIS and OneRoster sync.** CSV import first.
