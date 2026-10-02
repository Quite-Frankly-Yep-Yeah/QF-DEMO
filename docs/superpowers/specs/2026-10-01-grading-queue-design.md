# Grading queue (Phase 3) design

Date: 2026-10-01
Source plan: `docs/teacher-workflow-plan.md` §2.8, §3.5, §5 Phase 3, Q11, Q12.
Flag: `workflow_grading_queue` (Account), under the `teacher_workflow` umbrella.

## Purpose

One page where a teacher sees the grading they can do across all their courses, ordered so the work that holds students
back comes first. Each row says in plain words why it is there. Grading itself happens in the real SpeedGrader.

Success ("done when", from the plan): the top of the queue is the work holding students back, checked against a
300-student test course.

## Decisions recorded in this design

- **Ranking:** held-up students first, then oldest first within each tier (user, 2026-10-01).
- **Storage:** compute on read, no new queue table (approach A). Move to a maintained table only if the 300-student check
  shows it is too slow.
- **Audience:** only people who can grade. No read-only view for Mentors or Course Editors (user, 2026-10-01). Mentors get
  "waiting on a grade" from the Phase 6 student page.
- **Courses:** every course the viewer grades, not only self-paced ones (Q11). Self-paced signals add to the ranking where
  they exist.
- **Alert defaults:** `grading_backlog` threshold of 5 school days, notifies school admins only (user, 2026-10-01).
- **Not in scope:** accommodation-based ranking (Phase 3 has no privacy dependency), a new grader, follow-up tasks (Phase 4).

## Who sees the queue

A viewer's gradeable courses are those where they have `manage_grades` through an active teacher or TA enrollment.
Section-limited TAs only see students in their own sections. Account admins see every course in their account that they can grade (changed 2026-10-01 at the owner's request; it
was first limited to a course the admin names). Students, observers, mentors and Course Editors get an
empty result. With the flag off the page and API return 404.

## Rows

A row is one ungraded submission (a quiz attempt is the same row as its `Submission`):

- student, course, unit and item
- how long it has waited (`submitted_at`)
- due date, if any
- one plain reason, for example "Ryan is waiting on this to move on"
- a SpeedGrader link

For anonymous assignments with unposted grades the student shows as "Anonymous student" and the row is left out of the
student filter.

## Ranking

Each row falls into one tier. Rows sort by tier, then by oldest `submitted_at` first.

1. **Blocked.** The course has the player on and provisional mode off, and this item is the student's current item
   (`student_course_states.current_content_tag`), so the student cannot move on.
2. **Could re-lock.** The course has provisional mode on, the student has moved past this item, and a failing grade would
   lock them again.
3. **Due soon.** Due within 72 hours (calendar time).
4. **Everything else.**

Tiers 1 and 2 only apply in courses with the player on. Other courses use tiers 3 and 4.

Filters: course, unit (self-paced courses only), student, and a "held up only" toggle (tiers 1 and 2).

## Components

- **Namespace:** the code lives under `TeacherWorkflow`, not `Workflow`. The `workflow` gem defines a top-level `Workflow`
  module that Canvas models `include`, so a `Workflow` namespace would collide with it. URLs, API paths, flags and UI
  bundle names still say "workflow".
- `TeacherWorkflow::GradingQueue` (`app/services/teacher_workflow/grading_queue.rb`): takes the viewer and filters, returns
  ranked rows, counts per tier and turnaround. All tier and permission logic lives here. The API and UI do not decide who
  sees what.
- `TeacherWorkflow::GradingQueueController` and `GET /api/v1/workflow/grading_queue` with `course_id`, `unit_id`,
  `student_id`, `held_up` and `page`. Returns rows, tier counts and turnaround.
- Page at `/workflow/grading`, bundle `ui/features/workflow_grading_queue`, registered in `ui/featureBundles.ts`, linked from
  the existing Students area of the nav.
- `TeacherWorkflow::BacklogEvaluator`: the periodic job for the alert.
- Flag in `config/feature_flags/teacher_workflow.yml`.

## Data flow

One request:

1. Find the viewer's gradeable courses.
2. Run `Submission.needs_grading` over published assignments in those courses, scanned up to 500 rows. The response says
   when more exist.
3. Load `student_course_states` for those students in one query.
4. Tag each row with its tier from the student's current item and module order, using
   `SelfPaced::Gating.provisional?` and `awaiting_grade?`.
5. Sort, page, and cache for 60 seconds per viewer and filter set.

## Turnaround

Median time from `submitted_at` to `graded_at` over the last 30 days, computed from submissions with no history table. Shown
per course for the viewer's own grading. The per-teacher breakdown for admins is left for a later phase, because showing
teachers each other's numbers needs a decision about who may see them.

## The `grading_backlog` alert

- **Checked against the code (2026-10-01):** `self_paced_alerts` needs a non-null `student_id` and has a `kind` check
  constraint, and `AlertRule::KINDS` drives the course alert-rules editor. So the backlog alert does not reuse either. It
  gets its own small table, `workflow_backlog_alerts` (one open row per course), and the threshold is an account setting,
  `grading_backlog_days`, default 5 school days. This replaces the earlier idea of a new alert rule kind.
- The evaluator opens an alert for a course when its oldest waiting item is older than the threshold in school days
  (`SchoolCalendar#count_between`), and resolves it when the backlog clears.
- It notifies, once per opened alert, school admins who hold `self_paced_manage_alert_rules` on the course's account.
  Teachers are not notified.

## Errors and edge cases

- Flag off: 404.
- No gradeable courses: empty state, not an error.
- More than 500 ungraded rows: first 500 by the queue's own order, with a visible "showing the first 500" note.
- Excused and unsubmitted work never appears (already excluded by `needs_grading_conditions`).

## Testing

- Service specs for each tier and for oldest-first ordering within a tier.
- A permission matrix: teacher, section-limited TA, other teacher, student, mentor, observer, flag off.
- Anonymous-grading and request specs.
- Vitest for the page.
- A 300-student seeded course with a query count and timing check, which is the plan's "done when".
- A browser check of the real flow, measuring clicks to "graded" (R8 in the plan).
- Every phase ends with passing RSpec and JS tests and a short "what changed / how to try it" note.
