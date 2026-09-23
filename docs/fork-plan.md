# Self-paced mastery platform: discovery and build plan

Status: **revision 3, being built. Phase 0 is on branch `self-paced/phase-0` and Phase 1 on `self-paced/phase-1` (see §5).**
Date: 2026-09-22

Revision 3 records your answers to the §7 questions. It updates gating (§2.1), due dates (§2.3), the mentor role (§2.6),
activity data (§2.7), retention (§4), the roadmap (§5) and the risks (§6) to match.

This plan turns this codebase (originally Instructure's Canvas LMS) into a self-paced, mastery-based platform, similar to
Edgenuity or Odysseyware, for semi-virtual 9–12 schools. It covers:

1. how the relevant existing pieces work, with file paths,
2. what we extend and what we build,
3. the architecture,
4. a phased roadmap, with the riskiest assumptions and the decisions made (§7).

Paths are relative to the repo root. Line numbers are as of today's tree.

## What changed in revision 2

**This is no longer a fork, and it doesn't need to stay compatible with Canvas.** For the plan, that means:

- **We change core code directly** wherever that gives a simpler or sturdier design: gating, quiz rules, the course layout,
  course copy, notifications. The plugin isolation, monkeypatch registry and "core files we avoid touching" list from
  revision 1 are gone.
- **We own the upstream work.** Security fixes and dependency upgrades no longer arrive through upstream merges. We need our
  own process for them (R8).
- **Some compatibility still matters, for practical reasons:**
  - Import formats: Common Cartridge, Canvas export packages and QTI are how OER content gets in.
  - LTI, for any outside tools the schools use.
  - The AGPL: we still keep the license headers and notices, and still offer the source code to network users (AGPL §13).
- **Feature flags stay.** Each phase still ships behind its own flag, as you asked.
- **Cleanup becomes possible.** Hosted-only Canvas features (New Quizzes, Analytics Hub, Canvas Career) can be hidden now
  and removed later (§8).

---

## 0. Findings that shape the plan

| # | Finding | What it means for us |
|---|---------|----------------------|
| F1 | **Canvas already enforces item-by-item gating.** A module with `require_sequential_progress` plus a `min_percentage` requirement locks each item until the previous one is mastered. The lock applies to direct URLs, the API and quiz eligibility. | We build on that engine. What's missing gets added to it: per-student unlock/exempt, a video requirement and a provisional mode. We don't write a second lock system. |
| F2 | **New Quizzes cannot run here.** It is an LTI tool hosted by Instructure (`app/helpers/new_quizzes_features_helper.rb:45` needs `context.quiz_lti_tool`). | **Classic Quizzes** (`app/models/quizzes/`) is our assessment engine, and we now own it. |
| F3 | **Page views are off in this instance.** `enable_page_views` is unset, the default is `"false"` (`app/models/page_view.rb:107`), and `page_views` has 0 rows. The browser's activity pinger only runs when page views are on (`app/controllers/application_controller.rb:404`). | Time on task comes from our own small activity ledger, fed by the same pinger. Page views stay off (§2.7, decision 4). |
| F4 | **Analytics are hosted services.** Analytics Hub (`ui/features/analytics_hub/index.tsx` loads a remote module), New Analytics and Intelligent Insights run on Instructure's servers. The old `analytics` plugin that `AGENTS.md` mentions isn't in the repo. | Every dashboard metric is built here. |
| F5 | **Course Pacing only paces assignment-backed items, in whole days.** It publishes by writing per-student due-date overrides. Its "on pace" status is yes or no. | We build a pacing engine, and pull Course Pacing's calendar logic out into a shared service (§2.3). |
| F6 | **There is no version control.** `.git` is empty and `git log` fails. | Phase 0 sets up git so we have our own history, reviews and a baseline to measure against. |
| F7 | **The pilot content can't drive auto-gated mastery yet.** Course 4 (Algebra 1) has 164 Classic Quizzes, all `allowed_attempts = 1`, and every question is a teacher-graded essay. There's no public answer key. Its unit assessments aren't openly licensed, so there are no pretests. Its lessons are split by 82 text sub-headers, and it has no video embeds. | Mastery gating on these quizzes would wait for teacher grading every time. Decision 3: Algebra 1 is still the pilot, and it uses provisional mode (§2.1, R1). |
| F8 | **There's no websocket infrastructure.** No ActionCable exists. Live Events go to Kinesis for outside consumers. | Live monitoring polls (§2.8). |

---

## 1. How the existing pieces work

### 1.1 Modules, items, requirements and prerequisites

**Data model**
- `app/models/context_module.rb`: a module. Serialized settings (L31) hold `prerequisites` (other modules), `completion_requirements`, `requirement_count` (all or one), `require_sequential_progress` and `unlock_at`.
  - Requirement types: `must_view`, `must_mark_done`, `must_contribute`, `must_submit`, `min_score`, `min_percentage`.
  - The writer is `completion_requirements=` (L545). Actions are matched to requirements in `completion_requirement_for` (L948).
- `app/models/content_tag.rb`: a module item (`tag_type = 'context_module'`). Text sub-headers are `ContextModuleSubHeader` items.
- `app/models/context_module_progression.rb`: one row per user per module. It stores:
  - `workflow_state`: locked, unlocked, started or completed
  - `requirements_met`
  - `incomplete_requirements`, which keeps the best score so far
  - `current_position`

**Evaluation**
- The flow is `evaluate` (L469) → `evaluate_uncompleted_requirements` (L172) → `evaluate_current_position` (L429).
- An **excused** submission meets any scoreable requirement (L191).
- `must_submit` ignores grades a teacher entered without a submission (L204).
- **Numeric requirements aren't met while a grade is unposted** (L277).
- **A later, lower score takes away a requirement that was already met** (`update_requirement_met`, L336). That can re-lock items.
- Quizzes use `QuizSubmission#kept_score`, so the quiz's scoring policy applies (keep highest, latest or average). `min_percentage` divides by `points_possible` (L314).
- Items a student can't see are skipped (L184). That's how items hidden by Mastery Paths stop blocking completion.

**Locking**
- `ContextModule#available_for?` (L450) and `locked_for_tag?` (L477). The only lock on a single item is its sequential position.
- **There is no per-student unlock or exempt for an item.**

**Recording actions:** `ContextModule#update_for` (L939). Content calls `ContentTag#context_module_action(user, :read/:done/:contributed/:scored/:submitted)`.

**Progress**
- `app/models/course_progress.rb`: `progress_percent`, `current_content_tag`, `current_requirement_url`.
- GraphQL types: `app/graphql/types/module_progression_type.rb`, `course_progression_type.rb`, `module_item_mastery_path_info.rb`.

**APIs** (`app/controllers/context_module_items_api_controller.rb`, routes at `config/routes.rb:2345-2353`)
- `item_sequence` (L715): previous and next items. Implemented in `ApplicationHelper#context_module_sequence_items_by_asset_id`, `app/helpers/application_helper.rb:1199`.
- `mark_as_done` (L668), `mark_item_read` (L742) and `select_mastery_path` (L606).

**UI**
- `ui/features/context_modules`: the legacy modules page.
- `ui/features/context_modules_v2`: the React rewrite, behind the `modules_page_rewrite*` flags (`config/feature_flags/learning_foundations_release_flags.yml:161,182`).
- `ui/features/module_sequence_footer`: the next/previous footer.
- `ui/features/context_module_progressions`: the teacher's "student progress" page (`ContextModulesController#progressions`, L1176).

**Course copy and export:** `lib/cc/module_meta.rb` (export), `lib/cc/importer/canvas/module_converter.rb` and `app/models/importers/context_module_importer.rb` (import).

### 1.2 Mastery Paths (conditional release)

- Models are in `app/models/conditional_release/`:
  - A `Rule` has a trigger assignment.
  - Each rule has `ScoringRange`s, stored as fractions.
  - Each range has `AssignmentSet`s, and each set has `AssignmentSetAssociation`s.
- The feature is the course/account setting `conditional_release` (`app/models/course.rb:4158`, `account.rb:425`).
- Grading a trigger queues `OverrideHandler.handle_grade_change` (`app/models/submission.rb:2387`). The handler writes ADHOC overrides that release the matching set (`override_handler.rb:77`). Mastery Paths content is marked with a `Noop` override.
- If a range offers a choice of sets, the student picks one (`select_mastery_path`; UI in `ui/features/choose_mastery_path`).
- Rules API: `/api/v1/courses/:id/mastery_paths/rules` (`config/routes.rb:2932`).
- Released content must be backed by an assignment. Pages use a `wiki_page` placeholder assignment (`app/models/abstract_assignment.rb:1294`).

### 1.3 Course Pacing

- Models:
  - `app/models/course_pace.rb`: a pace for the course, a section or a single student enrollment (scopes L53-60).
  - `app/models/course_pace_module_item.rb`: a whole-day `duration`. **It refuses items without an assignment** (`assignable_module_item`).
- Scheduling:
  - `lib/course_pace_due_dates_calculator.rb` counts from the enrollment's `start_at`, `effective_start_at` or `created_at`.
  - It skips weekends or selected weekdays (`lib/course_paces_date_helpers.rb`).
  - It skips blackout dates: `app/models/blackout_date.rb` on an account or course, plus calendar events flagged as blackout across the account chain.
  - `lib/course_pace_hard_end_date_compressor.rb` fits a pace to a hard end date.
- **Publishing** (`CoursePace#publish`, L156) is a delayed `Progress` job. It writes ADHOC `AssignmentOverride` due dates for every student and item.
- **On/off pace** means "has any `missing` submission" (`app/services/course_pacing/course_pace_service.rb:38`).
- UI and API: `ui/features/course_paces`, `app/controllers/course_paces_controller.rb`, `app/controllers/course_pacing/`.
- Flags: `config/feature_flags/course_pace_feature_flags.yml`.

### 1.4 Quizzes

**Classic Quizzes**
- `app/models/quizzes/quiz.rb`:
  - `allowed_attempts`, which defaults to 1 (L152)
  - `scoring_policy`
  - `one_question_at_a_time` and `cant_go_back`
  - `show_correct_answers*`
- `app/models/quizzes/quiz_submission.rb`:
  - `attempt` and `extra_attempts`
  - `score_to_keep` (L484) and `attempts_left` (L681)
  - essay questions put the submission into `pending_review` (L788)
- `app/models/quizzes/quiz_extension.rb`: per-student `extra_attempts`, `extra_time` and `manually_unlocked`. Its APIs are in `app/controllers/quizzes/`.
- `app/models/quizzes/quiz_eligibility.rb`: the **single check for whether a student may start a quiz**. The quiz page uses it (`quizzes_controller.rb:1057`), and so does the API submission service (`quiz_submission_service.rb:299`). It includes module locks (L107), and its `declined_reason_renders` (L49) explains why a student can't start.

**Assignments:** `allowed_attempts` plus `Submission#extra_attempts`. Extra attempts are only allowed for upload, URL and text entry types (`app/models/submission.rb:1955`).

**New Quizzes:** `lib/services/new_quizzes.rb` and `app/models/quizzes_next/`. It depends on the hosted service, so it's out of scope.

### 1.5 Page views, asset access and enrollment activity

- **Page views** (`app/models/page_view.rb`):
  - The `enable_page_views` setting picks the backend: `false` (the default), `db`, `log` or `pv4`. PV4 is hosted by Instructure.
  - In `db` mode, the table stores `url`, context, asset, controller and action, `interaction_seconds`, `remote_ip` and `user_agent`.
  - Indexes: `[user_id, created_at]`, `[context_type, context_id]`, `[account_id, created_at]` (`db/migrate/20101210192618_init_canvas_db.rb:4045`).
- **The interaction pinger** (`ui/boot/initializers/trackPageViews.ts`):
  - It counts seconds in which mousemove, keypress, mousedown or focus happened.
  - It sends a PUT every 5 minutes while the student is active, and a beacon on unload. An idle tab sends nothing.
  - The server side is `ApplicationController#add_interaction_seconds` (L2073), capped at 10 minutes per view (`page_view.rb:96`).
  - It only runs when a page view exists (L404).
- **Logging path** in `ApplicationController`:
  - `generate_page_view` (L1974)
  - `log_asset_access` (L2001), which also posts the `asset_access` Live Event
  - `log_page_view` (L2055)
  - `log_participation` (L2096)
- **AssetUserAccess** (`app/models/asset_user_access.rb`): per user, asset and context. It stores `view_score`, `participate_score` and `last_access`. Old rows are deleted (L340).
- **Enrollment activity** (`app/models/enrollment/recent_activity.rb`):
  - `last_activity_at` is updated at most every 2 minutes.
  - `total_activity_time` grows by gaps of 2–10 minutes between requests.
  - It's a **single running total**, with no per-day breakdown.

### 1.6 Live Events

- `gems/live_events` posts events asynchronously to **Kinesis**.
- `lib/canvas/live_events.rb` has about 147 event builders, wired in `app/observers/live_events_observer.rb`.
- Configuration is in `config/dynamic_settings.yml:16` (localstack in dev). See `doc/live_events.md`.
- **We don't need it.** Since we can edit the models, our own `after_commit` hooks feed our rollups directly. Kinesis only becomes worth it if an outside data warehouse is added later.

### 1.7 Reports, alerts and notifications

- **Reports:**
  - `gems/plugins/account_reports` registers reports through `AccountReports.configure_account_report` (`lib/account_reports.rb:86`). They run as jobs that produce CSV attachments.
  - There is also a course-level `CourseReport` (`app/models/course_report.rb`).
- **Account/course alerts:**
  - `app/models/alert.rb` and `app/models/alerts/` (interaction, ungraded count, ungraded timespan, `delayed_alert_sender`)
  - permission `manage_interaction_alerts`
- **Observer alerts:** `app/models/observer_alert.rb` and `observer_alert_threshold.rb`. The types are a fixed list (L25-38) that we can extend.
- **Notifications:**
  - `app/models/notification.rb` (unsharded) with templates in `app/messages/`.
  - A new type is a migration that calls `Canvas::MessageHelper.create_notification` (`lib/canvas/message_helper.rb:68`; example: `db/migrate/20260427000000_add_access_token_expiring_soon_notification.rb`), plus its templates.
- **Student notes:** the faculty journal is gone. There's no `UserNote` model.
- **Grades:** `app/models/score.rb` holds the cached current and final scores per enrollment.

### 1.8 Roles, permissions, observers and messaging

- `app/models/role.rb`: a custom course role must be based on Student, Teacher, TA, Designer or Observer enrollment. Account roles are based on `AccountMembership` (L24-29).
- Permissions are defined in `config/initializers/permissions_registry.rb`. Relevant existing ones: `view_all_grades`, `manage_grades`, `read_roster`, `send_messages`, `read_reports`.
- Observers: `ObserverEnrollment` (`associated_user_id`) and `observed_users` (`app/helpers/observer_enrollments_helper.rb:31`).
- Messaging: Conversations (`ConversationsController#create`, L405).

### 1.9 Course navigation and layout

- The course home page (`default_view`) is limited to `assignments feed modules syllabus wiki` (`app/models/course.rb:806`). Tabs come from `Course.default_tabs` and `tabs_available` (L3543, L3713).
- The layout shows the course menu only when `@show_left_side` is set (`app/views/layouts/application.html.erb:84-91`).
- **Any page can already hide its chrome.** `?embedded=true` adds the `embedded` body class (`application_controller.rb:2967-2971`). That class hides the header, course menu, breadcrumbs and footer (`app/stylesheets/base/_layout.scss:29-32`).
  - It also hides the masquerade bar.
  - It also makes `in_mobile_webview?` return true.
- Canvas Career ("Horizon") is a precedent for swapping the learner experience in flagged courses: `Course#horizon_course?` (L4916) and `app/controllers/concerns/horizon_mode.rb`.

### 1.10 Video

- Canvas media: `app/models/media_object.rb` and `ui/shared/canvas-media-player/react/CanvasMediaPlayer.jsx`, rendered in an iframe.
- **There is no playback-completion tracking.**
- OER video is usually a YouTube or Vimeo embed inside a page. The sanitizer keeps an iframe's full `src`. YouTube *links* are turned into players in the browser (`packages/canvas-rce/src/enhance-user-content/enhance_user_content.js:81`). Web pages get no server-side rewriting: `youtube_banner_injection_service.rb` only runs for the mobile apps (`lib/api/html/content.rb:187`). Details are in `docs/spikes/video-tracking.md`.

### 1.11 Where things are registered

| Thing | Where |
|---|---|
| Feature flags | `config/feature_flags/*.yml` |
| Permissions | `config/initializers/permissions_registry.rb` |
| Migrations | `db/migrate`: `tag :predeploy`, `root_account` reference, `t.replica_identity_index` (e.g. `20260331080000_create_canvas_career_user_experiences.rb`) |
| Periodic jobs | `config/initializers/periodic_jobs.rb` (`Delayed::Periodic.cron`) |
| React bundles | `ui/features/<name>`, plus one line in `ui/featureBundles.ts`; loaded with `js_bundle` |
| Theming | `applyMaterialOverrides` (`ui/shared/react/materialTheme.ts`), applied by the React render wrapper (`ui/shared/react/index.tsx:25,47`). SCSS has `$md-elevation-*` in `app/stylesheets/base/_variables.scss:211` |
| Course settings | `add_setting` in `app/models/course.rb` (e.g. L4158) |

---

## 2. What we extend and what we build

| Feature | Starting point | Plan |
|---|---|---|
| **A. Course player** | `CourseProgress`, `item_sequence`, modules API, layout `@show_left_side` | **Build** the player. **Change the layout** so player courses use it. |
| A. Mastery gating | Module requirements (F1) | **Extend the core:** per-student overrides, `must_watch`, provisional mode, an option to keep mastery once earned |
| A. Lesson structure | Modules plus sub-headers | **Build** item settings (role, minutes, threshold). **Carry them through course copy and export.** |
| A. Full-view video | None | **Build:** a `must_watch` requirement checked on the server |
| A. Retake rules | `allowed_attempts`, `QuizExtension` | **Extend** `QuizEligibility` with a review-before-retake rule |
| A. Pretest / test-out | Mastery Paths | **Extend** with a setup wizard. Test-out per objective comes later. |
| A. Student pacing | Yes/no status only | **Build** |
| **B. Pacing engine** | Course Pacing calendar logic | **Build** a new engine. **Extract** the calendar logic into a shared service. Hide Course Pacing in self-paced courses. |
| **C. Roster, live view, drill-down** | `last_activity_at`, `Score`, progressions | **Build** a read model and UI |
| C. Activity data | Page views and the pinger | **Build** a separate pinger and ledger (§2.7) |
| C. Alerts | `Alert` pattern, Notification system | **Build** rules, and **add** notification types |
| C. Interventions | Excuse, `QuizExtension`, Conversations, the new overrides | **Build** a logged intervention service |
| C. Student notes | None | **Build** |
| C. Mentor role | Custom roles plus the permissions registry | **Extend** |
| **D. Reports** | `AccountReports`, `CourseReport` | **Extend** |
| D. Attendance | None | **Build** |
| **E. Observer view** | Observer enrollments and alerts | **Build** the view, and **extend** observer alert types |

### 2.1 Gating: extend the native engine

**Setup screen.** For each self-paced course, it writes the native settings:
- **Each unit module:** sequential progress on, and a prerequisite on the previous unit.
- **Instruction items:** `must_view`, or `must_watch` for videos.
- **Guided practice:** `must_submit`.
- **Graded checks:** `min_percentage: <threshold>`. The course default is 70%, stored as a course setting, and each item can override it.

The setup screen also warns about manual post policies, because unposted grades block gating (L277).

**Core additions to the module engine**, all behind `self_paced_course_player`:

1. **Per-student item overrides.** A new table, `module_item_student_overrides`, with kinds `unlock`, `exempt` and `complete`.
   - `ContextModuleProgression#evaluate_uncompleted_requirements` treats `exempt` and `complete` as met.
   - `ContextModule#locked_for_tag?` lets `unlock` through.
   - This gives a real unlock or exemption for any item type, graded or not, **without excusing a grade**.
2. **A `must_watch` requirement.** It's met when the server-side video progress record reaches the configured fraction (§2.9). Students can't mark it done themselves.
3. **Provisional mode for teacher-graded checks** (decision 3). A submitted check that's still `pending_review` counts as met *provisionally*, so the student can continue. When the teacher grades it, a failing grade re-locks the items after it, the same way item 4 describes.
4. **Re-lock on a lower score, and tell the mentor** (decision 6).
   - We keep Canvas's current behavior. A lower score takes away a met requirement (L336), and with sequential progress, every item after it locks again.
   - We add a **"re-locked" notification to the student's assigned mentors** (§2.6). It names the item and the score, and links to the student's page in the dashboard, where the mentor can unlock (§2.5).
   - **For a retake to lower the score, checks have to score by the latest attempt.** Classic Quizzes defaults to `keep_highest` (`quiz.rb:156`), and that never lowers the kept score. So the setup screen sets checks to `keep_latest`.
   - **Side effect:** in provisional mode, a failing grade can arrive days later and re-lock several lessons the student has already moved on to. The notification and the dashboard's "re-locked" status make that visible, so the mentor can decide what to do.

These changes touch paths every course uses, so each one is behind a check for self-paced courses and gets focused specs. The performance of `locked_for?` is covered in §3.5.

### 2.2 Retakes: one rule in `QuizEligibility`

- **The quiz's own settings stay the single source of truth:** `allowed_attempts` is the maximum, and `scoring_policy` is usually keep-highest.
- **A new quiz setting, `retake_requires_review`.** Before a student can start attempt *n*+1 after a non-mastery attempt, `QuizEligibility` requires a review record for attempt *n*. A clear explanation is added to `declined_reason_renders`.
  - Because the quiz page and the API both use `QuizEligibility`, one check covers both.
- **What counts as a review is configurable per quiz:**
  - opening the graded attempt's results, and/or
  - re-opening the lesson's instruction items after the failed attempt (checked with `AssetUserAccess.last_access`).
  - The review is stored in `quiz_attempt_reviews`.
- **Teacher unlock after the maximum** uses the existing `QuizExtension` extra attempts, logged as an intervention.

### 2.3 Pacing: a new engine and a shared calendar

**Refactor:**
- Pull the blackout-date and weekday logic out of `CoursePacesDateHelpers` and `CoursePaceDueDatesCalculator#blackout_dates` into a shared `SchoolCalendar` service.
- Add `instructional_calendars`: a per-account (school) weekday pattern and minutes per day, so half days are possible.
- Keep `BlackoutDate` for days with no instruction.
- Course Pacing keeps working on the shared service. It's hidden in self-paced courses so there aren't two pacing systems.

**Engine inputs:**
- the enrollment start date
- the target end date (per student; the default comes from the section, term or course end)
- the school calendar
- the ordered items the student can see, including items released by Mastery Paths
- estimated minutes per item: the defaults come from the content (words for pages, questions for quizzes, duration for video), and teachers can override them

**Engine output:**
- a daily minute target and a planned date for every item
- **days ahead or behind:** the instructional day on which the student's completed minutes *should* have been reached, minus today's instructional day
- **today's target** and **the weekly goal:** planned items through today and through the end of the week
- two plans: an immutable **baseline** for reporting, and a **current** plan that re-spreads the remaining work from today

**Recalculation triggers:** enrollment dates, target date, calendar or blackout changes, module content changes, Mastery Paths releases, and teacher edits. Each queues a debounced job per enrollment.

**Due dates change dynamically** (decision 1).
- **What's written.** Pacing writes each student's planned dates onto their graded items (quizzes, assignments, graded discussions) as that student's due dates. When the current plan is recalculated, the dates move with it. Students see them in the calendar, the To Do list and the gradebook.
- **How.** The same mechanism Course Pacing uses: ADHOC `AssignmentOverride`s, grouping students who share a date (`CoursePace#publish`, L156). Course Pacing is hidden in self-paced courses, so there's never more than one writer.
- **Rules that keep it sane:**
  - Only write dates that actually changed.
  - Never move the due date of an item the student has already submitted.
  - Leave teacher-set overrides alone. A teacher's date wins over the plan's.
  - Dates shift at most once a day: in the nightly recalculation, plus immediately after an explicit change (new target date, enrollment dates, calendar edit). A student's dates don't jump around during the day.
- **Late and missing.** Because dates follow the current plan, a student who falls behind has their future dates pushed out rather than piling up "missing" work. Items whose planned date has already passed stay due on that date. So "missing" means "behind pace on this item", which matches the dashboard.
  - Late penalties are **off by default** in self-paced courses (the course's late policy). Teachers can turn them on.
- **Baseline for reporting.** The baseline plan is never written onto assignments. It's only used to report on-pace history.

### 2.4 The course player

- **Player home page.** Add `player` as a `default_view` option (`course.rb:806`). Students in a player course land on `/courses/:id/player`. It's a React course map with units, lessons and items, their lock state, a progress bar, pacing status and a "Continue" button.
- **Player layout on item pages.** Native item pages (pages, quiz taking, assignments, discussions) render with `@show_left_side = false`. The layout gets a player bar: progress, a course map drawer, previous and next, and today's target. `module_sequence_footer` is replaced.
  - To hide the rest of the chrome, the player adds its own `self-paced-player` body class that reuses the `embedded` CSS rules (§1.9).
  - It doesn't use the `?embedded` parameter, because that would also hide the masquerade bar and switch on mobile-webview behavior.
  - Quiz taking, submissions and LTI launches keep working unchanged, because they're the same pages.
- **Where the change goes.** A `SelfPaced::PlayerLayout` concern included in `ApplicationController` decides when a request is a "player request", the same way the Horizon concern does. The layout change itself goes in `application.html.erb`.
- **Teachers and mentors** keep the normal course view, with a "view as player" toggle.

### 2.5 Interventions

Every intervention writes an append-only audit row: actor, real user when masquerading, student, target, reason and payload. It also checks the matching permission.

| Intervention | Mechanism | Also requires |
|---|---|---|
| Unlock item | `module_item_student_overrides(kind: unlock)`; for quizzes also `QuizExtension manually_unlocked` | — |
| Grant extra attempts | `QuizExtension extra_attempts` or `Submission#extra_attempts` | `manage_grades` |
| Reset attempt | Grant +1 attempt and mark the old attempt "reset" in the log, keeping it as evidence (decision 7) | `manage_grades` |
| Exempt | `override(kind: exempt)` removes the item from gating and pacing. A graded item is also excused, so it doesn't count in the grade. | `manage_grades` for graded items |
| Mark complete | `override(kind: complete)` | — |
| Adjust target end date | Update the plan, then recalculate | — |
| Add note | `student_notes` | — |
| Send message | Conversations service | `send_messages` |

**Bulk actions** run the same service for each student inside a `Progress` job.

### 2.6 Mentor role and permissions

New permissions in `permissions_registry.rb`, available at course and account level:

- `self_paced_view_dashboard`
- `self_paced_view_live_monitor`
- `self_paced_manage_notes`
- `self_paced_unlock_items`
- `self_paced_manage_attempts`
- `self_paced_adjust_pacing`
- `self_paced_manage_alert_rules`
- `self_paced_view_reports`

**Mentor** = a custom **account** role (based on `AccountMembership`), granted on a school's sub-account (decision 2).
- Mentors see **every student** in that school's self-paced courses, without being enrolled in each course.
- A course role couldn't do this: mentors would need an enrollment in every course of every student.
- Permissions:
  - **on:** the dashboard, live monitor, notes and unlock permissions, `read_roster`, and `view_all_grades` (read-only). Grade visibility was left blank, so this uses the default: mentors see grades but can't change them.
  - **off:** `manage_grades`, and everything that edits course content.

**Caseload ("pinned" students)**
- A new table, `mentor_caseloads`, stores mentor, student, account, and who pinned the student.
- Mentors pin and unpin students themselves. Admins can also assign students in bulk.
- The dashboard shows a **"My caseload"** section above the full roster, and every roster filter can be limited to it.

**Assigned mentor** = any mentor whose caseload includes the student.
- Notifications meant for "the assigned mentor" go to them: re-locks (§2.1) and alerts (Phase 6).
- If a student has no assigned mentor, those notifications go to the course's teachers.

Teachers keep course-level access through their teacher enrollment, as before.

**To check in Phase 2**
- **Account-role reach:** an account-level role can reach course pages through account permissions such as `read_course_content`. We grant only what the dashboard needs, and a spec checks that a mentor can't open gradebook edits or course settings.
- **Messaging:** Conversations normally needs a course the sender and recipient share. An account-role mentor may need its own messaging path to students.

### 2.7 Activity data: a small ledger instead of raw page views

We only record what the features need. Decision 4: **ledger only. Page views stay off.**

*As built in Phase 1:*
- **The pinger.** A small tracker in the browser (`ui/shared/self-paced/activityTracker.ts`) runs for students in courses with activity tracking on. It counts seconds with mouse, keyboard, scroll or touch activity.
  - While the tab is visible, it posts once a minute to `POST /api/v1/courses/:id/self_paced/activity`, with the active seconds (which may be 0), the module item id and the path.
  - A beacon sends the remainder when the tab is hidden or closed.
  - The existing page-view pinger is left alone.
- **The ledger.** `SelfPaced::ActivityLedger` writes each ping straight to Postgres with single "add to the total" upserts into `activity_days`, `item_times` and the presence columns of `student_course_states`. At school scale that's about 5–15 small writes a second for 300 active students. It's simpler than Redis counters and can't lose counts, so Redis is only worth adding if write load ever shows up.
- **What's ignored.** Pings from teachers, admins acting as students, and the test student are ignored. The ping endpoint doesn't update Canvas's own enrollment "last activity", so an idle tab doesn't inflate it.
- Raw rows with URL, IP address and user agent are never stored.

If staff later need page-level records for academic-integrity investigations, page views can be turned on separately. No feature depends on them.

State changes (submissions, quiz submissions, module progress, grades) reach our rollups through `after_commit` hooks we add to those models directly. Live Events aren't needed.

### 2.8 Live monitoring

- **Online:** a ping in the last 2 minutes (`student_course_states.last_seen_at`). The pinger sends a ping every minute while the tab is visible, even with 0 active seconds, so an open-but-idle tab still counts as online.
- **Idle:** online, but no active seconds for N minutes (`last_active_at`; N is configurable).
- **Current item and time on it:** `viewing_content_tag_id` and `viewing_since`. That clock restarts only when the student moves to a different page.
- **Refresh:** the dashboard polls every 30 seconds, and the server caches the roster for 15 seconds per course.
- **Websockets** would only be needed if 30-second polling proves too slow. That's unlikely at school scale.

### 2.9 Video completion

- **YouTube and Vimeo embeds.** In player courses, the player script adds the players' API flag to each embed's `src` before playback (`enablejsapi=1` or `api=1`), and so does the link-to-player code in `enhance_user_content.js`. The script then tracks which segments were actually watched, not just seek position, and posts the highest fraction watched. The Phase 0 spike is in `docs/spikes/video-tracking.md`.
- **Canvas media.** `CanvasMediaPlayer.jsx` is changed to post the same progress events.
- **What's stored:** the highest fraction watched per student and item, and when the item was completed, in `video_progress`.
- **When `must_watch` is met:** when that fraction reaches the configured level. The default is 95%.

### 2.10 Attendance data model (kept flexible on purpose)

We keep **facts** separate from **policy**:

- `activity_days` stores per student, course and date: active seconds, distinct items touched, submissions, participations, and first and last activity.
- `attendance_policies` are versioned rule sets with effective dates. Examples: at least N active minutes per day, whether a submission counts as present, weekly hour minimums, how to round, which calendar applies.
- `attendance_adjustments` are logged manual corrections, such as documented offline work.

Reports evaluate a policy version over the facts. When the state rules arrive, we add a policy, not a migration, and old reports stay reproducible.

---

## 3. Architecture

### 3.1 Code layout

New code lives in the normal app directories under a `SelfPaced` namespace, so it's easy to find:

```
app/models/self_paced/            # item settings, overrides, plans, states, activity, interventions, notes, alerts, attendance
app/services/self_paced/          # gating helpers, retake rules, pacing engine, SchoolCalendar, ledger, state refresher, alerts
app/controllers/self_paced/       # player, dashboard, API (/api/v1/self_paced/...)
app/controllers/concerns/self_paced/player_layout.rb
lib/cc/...                        # export/import of item settings (edited in place)
config/feature_flags/self_paced.yml
spec/models/self_paced/, spec/services/self_paced/, spec/controllers/self_paced/, spec/requests/self_paced/
ui/features/self_paced_player/    # course map + player bar
ui/features/self_paced_dashboard/ # roster, live view, drill-down, alerts, interventions
ui/features/self_paced_setup/     # item roles, estimates, thresholds, retake rules, test-out wizard
ui/features/self_paced_observer/
ui/shared/self-paced/             # API client, types, shared components
```

All new UI renders through `@canvas/react`, so it gets the Material 1 overrides automatically. We use InstUI components with no custom colors, so Theme Editor branding keeps working. Server-rendered additions like the player bar use the `$md-elevation-*` SCSS variables.

### 3.2 Core code we'll change

| Area | Files | Change |
|---|---|---|
| Gating | `context_module.rb`, `context_module_progression.rb` | Overrides, `must_watch`, provisional mode, re-lock notification (§2.1) |
| Requirement API and UI | `context_module_items_api_controller.rb`, `ui/features/context_modules_v2` | New requirement type in the API and module settings |
| Quizzes | `quizzes/quiz.rb`, `quizzes/quiz_eligibility.rb`, quiz settings UI | `retake_requires_review` (§2.2) |
| Course | `course.rb` | `player` home page option, self-paced settings |
| Layout | `application_controller.rb`, `layouts/application.html.erb`, `stylesheets/base/_layout.scss` | Player layout concern, player bar, `self-paced-player` body class |
| Activity | `application_controller.rb`, `runOnEveryPageButDontBlockAnythingElse.jsx`, `submission.rb`, `score.rb`, `context_module_progression.rb`, `user.rb`, `lib/user_merge.rb` | Pinger config and loader, one-line model hooks, purge and merge (§2.7) |
| Media | `CanvasMediaPlayer.jsx`, embed rewriting | Progress events (§2.9) |
| Pacing | `course_paces_date_helpers.rb`, `course_pace_due_dates_calculator.rb`, `course_pace.rb` | Extract `SchoolCalendar`. Reuse the override-writing part of `CoursePace#publish` for dynamic due dates (§2.3) |
| Course copy | `lib/cc/module_meta.rb`, `lib/cc/importer/canvas/module_converter.rb`, `importers/context_module_importer.rb` | Carry item settings and quiz retake rules |
| Observers | `observer_alert_threshold.rb` | New alert types: behind pace, inactive |
| Notifications | `db/migrate`, `app/messages/` | New notification types: "item re-locked" (Phase 3) and alerts (Phase 6) |
| User deletion and merge | `app/models/user.rb`, `lib/user_merge.rb` | Purge or move our rows (§4) |
| Reports | `gems/plugins/account_reports` | "Self-paced" report family |

### 3.3 New tables (all have `root_account_id` and a replica identity index)

| Table | Purpose | Key indexes |
|---|---|---|
| `module_item_settings` | Role (instruction, practice, check, pretest), estimated minutes, weight, threshold override, video requirement | unique `content_tag_id`; `course_id` |
| `module_item_student_overrides` | Unlock, exempt or complete, plus a link to the intervention | unique `(content_tag_id, user_id, kind)` where active; `(course_id, user_id)` |
| `quiz_attempt_reviews` | Review done for an attempt | unique `(quiz_submission_id, attempt)` |
| `video_progress` | Highest fraction watched, completion time | unique `(user_id, content_tag_id)` |
| `instructional_calendars` | Weekday pattern and minutes per day, per account | `account_id` |
| `pacing_plans` | Start date, target date, baseline and current schedule (jsonb), version | unique `(course_id, user_id)` where active |
| `student_course_states` | **Dashboard read model:** current item and when it started, % complete, days ahead/behind, score, last active, minutes today and this week, failed attempts on the current item | unique `(course_id, user_id)`; `(course_id, days_behind)`; `user_id` |
| `activity_days` | Daily engagement facts | unique `(user_id, course_id, day)`; `(course_id, day)` |
| `item_times` | Time per item | unique `(user_id, content_tag_id)`; `(course_id, user_id)` |
| `interventions` | Append-only audit log | `(course_id, created_at)`, `(student_id, created_at)`, `(actor_id, created_at)` |
| `student_notes` | Staff-only notes | `(student_id, created_at)` |
| `mentor_caseloads` | Mentor's pinned or assigned students, per school account | unique `(mentor_id, student_id, account_id)`; `(student_id)` for "who is this student's mentor" |
| `alert_rules` / `self_paced_alerts` | Rules and alert instances (`alerts` is already taken) | `(course_id, workflow_state)`; partial unique `(rule_id, student_id, course_id)` where open |
| `attendance_policies` / `attendance_adjustments` | §2.10 | `(account_id, effective_at)` |

### 3.4 Feature flags (`config/feature_flags/self_paced.yml`)

| Flag | Applies to | Gates |
|---|---|---|
| `self_paced` | RootAccount | Umbrella flag |
| `self_paced_activity_tracking` | Account | The ledger. Separate so data collection itself can be switched on or off for FERPA. |
| `self_paced_course_player` | Course | Player, gating additions, retake rule, video completion |
| `self_paced_pacing` | Course | Pacing engine and student pacing widgets |
| `self_paced_teacher_dashboard` | Account | Roster, live view, drill-down, mentor permissions |
| `self_paced_interventions` | Account | Intervention and bulk tools |
| `self_paced_alerts` | Account | Alert rules, notifications |
| `self_paced_reports` | Account | CSV reports, attendance |
| `self_paced_observer_view` | Account | Observer view, new observer alert types |
| `self_paced_test_out` | Course | Test-out wizard |

### 3.5 Performance

- **Dashboard reads** only use `student_course_states` joined to enrollments. Example: 300 students × 8 courses = 2,400 indexed rows, sorted and paged on the server. Per-student progress (`CourseProgress` is about 10–20 queries) only runs in background jobs.
- **Refresh jobs:** a debounced singleton job per enrollment (`self_paced:state:<enrollment_id>`), on a per-course strand, plus a nightly full rebuild to repair drift.
- **The ledger** makes one small upsert per table per ping and never scans `page_views` (§2.7).
- **Gating lookups:** `locked_for?` is called often. Per-student overrides are loaded once per user and course and cached with the progression. The self-paced check is a cached course setting, so other courses pay almost nothing.
- **Caching:** per-course structure (ordered items, estimates, requirement map), keyed on the modules' latest `updated_at`. The live roster is cached for 15 seconds per course.
- **Permissions across many courses:** preload the teacher's enrollments and role overrides once per request. Don't check course by course.
- **Sharding:** there's one shard today. The code keeps state rows on the course's shard so that it stays shard-safe.

---

## 4. FERPA and data handling

- Every endpoint checks the course permissions plus our own permissions.
- Observers only see students linked through `ObserverEnrollment`, and only **posted** grades.
- Mentors see every student in their school's self-paced courses (decision 2). Grades are read-only. This is broader than per-course access, so the school should confirm it meets its FERPA "legitimate educational interest" policy (R7).
- We store aggregates only: seconds per day and per item, highest fraction of video watched, and attempt counts. Page views stay off (§2.7), so no URLs, IP addresses or user agents are stored at all.
- Audit logs record the real user during masquerade. Notes are staff-only.
- **Retention (decision 5):** all of our student data is kept **until the student's user record is deleted**. That covers activity facts, item times, video progress, pacing plans, states, interventions, notes, caseload rows and attendance facts. There's no time-based expiry.
  - Deleting a user queues a job that permanently removes their rows from our tables.
  - Merging two users moves the rows to the surviving user.
  - A spec covers both.
  - Volume stays small: about one `activity_days` row per student, course and active day.

---

## 5. Phased roadmap

Every phase ends with passing RSpec (`bin/rspec spec/.../self_paced/...`) and JS tests (`yarn test` / `yarn test:vitest`), and a short "what changed / how to try it" note.

**Phase 0: Foundations.** Flag: `self_paced`.
- Set up git and commit the current tree as the baseline. Confirm the test commands run in the Docker web container.
- Hide hosted-only features in the UI: New Quizzes, Analytics Hub, Canvas Career (§8).
- Add the flag file, the permissions and the `SelfPaced` namespace.
- One spike: YouTube and Vimeo watch tracking inside sanitized page content (R2).

**Phase 1: Activity ledger and read model.** Flag: `self_paced_activity_tracking`.
- Pinger, ping endpoint, ledger upserts into `activity_days`, `item_times` and presence columns. **Done 2026-09-22.**
- Model hooks, the state refresher, the nightly rebuild.

**Phase 2: Teacher dashboard v1.** Flag: `self_paced_teacher_dashboard`.
- Roster (all columns except pacing), live monitoring, drill-down (timeline, attempts, time per item).
- Permissions, the account-level Mentor role, and caseload pinning with the "My caseload" section (§2.6).

**Phase 3: Course setup, gating and player.** Flag: `self_paced_course_player`.
- Item settings and the setup screen.
- Gating additions (§2.1) and the retake rule (§2.2).
- The "item re-locked" notification to assigned mentors. This notification type moves up from Phase 6.
- Player home page and layout (§2.4), video completion (§2.9).
- Course copy and export of the new settings.
- **Algebra 1 pilot setup (decision 3):**
  - each lesson's **Classwork** quiz is guided practice (`must_submit`)
  - each lesson's **Ready, Set, Go** quiz is the check: `min_percentage` 70%, `keep_latest`, provisional mode
  - the lesson page is instruction (`must_view`)
  - units are chained by prerequisites

**Phase 4: Pacing.** Flag: `self_paced_pacing`.
- `SchoolCalendar` extraction and instructional calendars.
- Plan generation and recalculation.
- Dynamic due dates written onto graded items (§2.3), with late penalties off by default.
- Student widgets, dashboard pacing columns, and the planned-vs-actual chart.

**Phase 5: Interventions.** Flag: `self_paced_interventions`.
- Every §2.5 tool, bulk actions, notes, messaging and the audit log.

**Phase 6: Alerts.** Flag: `self_paced_alerts`.
- Rule types: behind pace, stuck on an item, max attempts reached, inactive, grade below threshold.
- A periodic evaluator, open and resolved alert states.
- New notification types, so each user controls email in their notification preferences.

**Phase 7: Reports and attendance.** Flag: `self_paced_reports`.
- A report family for admins, and CSV exports scoped to the teacher's own courses.
- Reports: progress, time on task, pacing, intervention log, and engaged days.
- Attendance policies (§2.10).

**Phase 8: Observer view.** Flag: `self_paced_observer_view`.
- Read-only page: progress, pacing, recent posted grades, time on task.
- Observer alert types for "behind pace" and "inactive".

**Phase 9: Test-out.** Flag: `self_paced_test_out`.
- A wizard that builds Mastery Paths rules: pretest → below threshold releases the lessons, at or above releases nothing.
- Pacing recalculates when content is released.
- Later: per-objective test-out using outcome alignments.

**Phase 10 (optional): Cleanup.** Remove the hosted-only features hidden in Phase 0 (§8).

The order is data → dashboard → player, because the dashboard is the core of the project and can run on native module data first. If you'd rather have students on the player sooner, Phases 2 and 3 can swap.

---

## 6. Riskiest assumptions

| # | Assumption | Risk | How we reduce it |
|---|---|---|---|
| R1 | Imported OER provides **auto-graded** checks and pretests | **High.** Course 4's checks are all teacher-graded essays with no answer keys, and its assessments aren't openly licensed (F7). | Decided: the Algebra 1 pilot uses provisional mode, so students keep moving and teachers grade later. Optional content work: draft answer keys for questions with one checkable answer, kept **unverified until a teacher approves them**. Approved questions then switch to auto-graded. A wrong key would block students, so nothing goes live unreviewed. |
| R2 | Full-view video can be tracked reliably | **High.** Embeds are cross-origin iframes inside sanitized HTML. | Phase 0 spike, YouTube and Canvas media first. Store only the highest fraction watched. |
| R3 | Gating changes don't slow down or break normal courses | Medium. `locked_for?` and progression evaluation run everywhere. | Self-paced check first, caching, focused specs, and a before/after query count in specs. |
| R4 | Activity signals give a fair "time on task" | Medium. Watching a video with no mouse or keyboard input looks idle. | Count video playback as active time. Label time on task as an estimate in the UI. |
| R5 | Classic Quizzes stays maintainable | Medium. It's legacy jQuery-era code that Instructure has been moving away from, and we now own it. | Keep our changes small and covered by specs. Revisit a new assessment engine only if Classic becomes a blocker. |
| R6 | Mastery Paths can express test-out | Low–Medium. One trigger per rule, released content must be assignment-backed, and the trigger must be graded. | Phase 9 wizard. Per-objective test-out later. |
| R7 | School-wide mentor access matches the school's FERPA policy | Policy risk. Mentors see all students in their school (decision 2). | Read-only grades, audit log of interventions, caseload for focus. The school confirms the policy before rollout. |
| R8 | **We keep up with security fixes without upstream** | **High, and ongoing.** Canvas security patches and dependency updates no longer arrive by merging. | Set up a routine: watch Canvas security advisories and releases, port relevant fixes, and run `bundle audit` and `yarn audit`. |
| R9 | Re-locking after a late failing grade doesn't frustrate students | Medium. In provisional mode, grading can arrive days later and re-lock several lessons (§2.1). | Mentor notification with a link to unlock, a "re-locked" status in the dashboard, and fast grading turnaround in the pilot. |
| R10 | Rewriting due dates at scale stays fast | Medium. Hundreds of students × hundreds of graded items, each change recalculating cached due dates and grades. | Write only changed dates, group students by date, batch in the nightly job, and suspend due-date caching during the batch like `CoursePace#publish` does. Measure in Phase 4 with a 300-student test course. |

---

## 7. Decisions (recorded 2026-09-22)

Your answers are in the "Answer" column. Where you left a question blank or said "whatever you see fit", the "What we'll do" column says what I chose. Tell me if any of it should change.

| # | Question | Answer | What we'll do |
|---|---|---|---|
| 1 | Due dates: advisory, or written onto graded items? | "Due dates should dynamically change." | **Per-student due dates follow the current plan**, updated at most once a day, never on submitted items. Late penalties are off by default (§2.3, R10). |
| 2 | Mentor scope, and can mentors see grades? | "Mentors should be able to see all students but should have a 'pinned' section for a caseload filter." Grades: *(blank)* | **Account-level Mentor role** per school, with a **caseload** of pinned students (§2.6). Grades are **read-only (default)**. |
| 3 | Pilot course, and how to handle teacher-graded checks | "It should be Alg 1 and do whatever you see fit." | **Algebra 1 with provisional mode.** Ready, Set, Go quizzes are the checks, Classwork quizzes are practice. Answer keys are optional later work, and only go live after a teacher approves them (§5 Phase 3, R1). |
| 4 | Activity data: ledger only, or page views too? | "Whatever you see fit." | **Ledger only.** Page views stay off (§2.7). |
| 5 | Retention | "Until the student profile is deleted." | Keep all of our student data until the user is deleted, then purge it. Merges move it (§4). |
| 6 | Should a lower retake score leave an earned item completed? | "It should relock and send a notification to your assigned mentor." | **Re-lock (Canvas's behavior)** plus an **"item re-locked" notification** to the student's assigned mentors. Checks use `keep_latest` so a retake can lower the score (§2.1). |
| 7 | Reset = grant an attempt and log it? | "Yes." | As planned (§2.5). |

---

## 8. Cleanup we could do later (not required)

These Canvas features don't work without Instructure's hosted services, or overlap with this product. Phase 0 hides them. Removing them is optional, low priority, and should wait until the new features are stable.

- **New Quizzes** (`quizzes_next`, `lib/services/new_quizzes.rb`, quiz migration prompts)
- **Analytics Hub and Intelligent Insights**: the `analytics_hub` flag, `title_iv_financial_aid_report` and related
- **Canvas Career / Horizon** (`app/services/canvas_career`, `horizon_mode.rb`)
- **Course Pacing**, if the new engine fully replaces it
- **Kinesis Live Events config**, if no outside consumer is planned
- **Renaming internal `Canvas` identifiers** (`Canvas::`, `@canvas/*`). The rebrand kept these for plugin compatibility, which no longer matters. It's a large, mechanical change, and only worth doing as its own project.

