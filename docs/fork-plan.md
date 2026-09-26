# Self-paced mastery platform: discovery and build plan

Status: **revision 3, being built. Phases 0 to 5b are done, each on its own `self-paced/phase-N` branch (see §5).**
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
- Canvas Career ("Horizon") was a precedent for swapping the learner experience in flagged courses (`Course#horizon_course?` and `app/controllers/concerns/horizon_mode.rb`). Both were removed in Phase 10; the pattern to follow now is `SelfPaced::PlayerLayout`.

### 1.10 Video

- Canvas media: `app/models/media_object.rb` and `ui/shared/canvas-media-player/react/CanvasMediaPlayer.jsx`, rendered in an iframe.
- **There is no playback-completion tracking.**
- OER video is usually a YouTube or Vimeo embed inside a page. The sanitizer keeps an iframe's full `src`. YouTube *links* are turned into players in the browser (`packages/canvas-rce/src/enhance-user-content/enhance_user_content.js:81`). Web pages get no server-side rewriting: `youtube_banner_injection_service.rb` only runs for the mobile apps (`lib/api/html/content.rb:187`). Details are in `docs/spikes/video-tracking.md`.

### 1.11 Where things are registered

| Thing | Where |
|---|---|
| Feature flags | `config/feature_flags/*.yml` |
| Permissions | `config/initializers/permissions_registry.rb` |
| Migrations | `db/migrate`: `tag :predeploy`, `root_account` reference, `t.replica_identity_index` (e.g. `20260922230000_create_self_paced_activity_tables.rb`) |
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
- *As built:* the review setting lives on the item (`module_item_settings.retake_review`), not on the quiz.
- **What counts as a review:** reopening one of the lesson's instruction items (the ones before the check in the same module) after the failed attempt. The check uses our item-time ledger, with `AssetUserAccess.last_access` as a fallback. Opening the results page doesn't count, because Canvas shows it automatically right after every attempt. So no `quiz_attempt_reviews` table is needed.
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
- **Where the change goes.** A `SelfPaced::PlayerLayout` concern included in `ApplicationController` decides when a request is a "player request" (the removed Canvas Career `HorizonMode` concern worked the same way). The layout change itself goes in `application.html.erb`.
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
- A new table, `mentor_caseloads`, stores the mentor, the student and the root account. *As built:* pins are kept per root account, not per school, so a pin follows a student who changes schools within the district.
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
- **Done 2026-09-23.** The page is at `/self_paced/dashboard`, with a "Student Dashboard" course tab for staff. Create the role with `SelfPaced::MentorRole.ensure!(root_account)`.

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
- **Done 2026-09-23.** What was built:
  - **Course map:** `/courses/:id/player`.
  - **Player bar:** added by `SelfPaced::PlayerLayout` from the layout, which hides the course menu (the layout sets `@show_left_side` itself, because helper methods run on the controller).
  - **Setup screen:** the teacher-only **Course Player** tab (`/courses/:id/player_setup`).
  - **Video tracking:** `ui/shared/self-paced/videoTracker.ts` (YouTube, Vimeo, HTML5/Canvas media).
  - **Course copy:** via `self_paced_settings_json` on module items.

**Phase 4: Pacing.** Flag: `self_paced_pacing`.
- `SchoolCalendar` extraction and instructional calendars.
- Plan generation and recalculation.
- Dynamic due dates written onto graded items (§2.3), with late penalties off by default.
- Student widgets, dashboard pacing columns, and the planned-vs-actual chart.
- **Done 2026-09-24.** What was built:
  - **Calendar:** `SchoolCalendar` (`app/services`) owns blackout days for both pacing systems: course and account `BlackoutDate`s plus blackout calendar events. Course Pacing's calculator now reads them from it, so account-level blackout dates count for Course Pacing too. `InstructionalCalendar` holds a school's minutes per weekday and per date; the nearest one up the account chain applies (default Monday to Friday, 360 minutes).
  - **Engine:** `SelfPaced::Pacer` with `PlanBuilder` (spreads minutes over days in proportion to each day's minutes) and `Estimator` (teacher estimate, else reading time for pages, 3 minutes a quiz question, flat defaults). Plans live in `pacing_plans`: a fixed baseline for "days ahead or behind", and a current plan re-spread from today at most once a day. The state refresher (debounced and nightly) makes and re-spreads plans; setup, calendar and blackout changes re-spread a whole course right away.
  - **Target dates:** the course's "Finish date" (setup screen), then the enrollment's, section's, course's or term's end, then 36 weeks from the start. Staff with `self_paced_adjust_pacing` (now part of the Mentor role) can give one student their own date from the tray.
  - **Due dates:** `SelfPaced::DueDateWriter` writes ADHOC overrides titled "Self-paced plan", following the §2.3 rules. **Change from the plan:** it only dates the next 10 school days (plus items it already dated). Writing every item took about 45 seconds per student in Algebra 1, and a daily re-spread moves nearly every future date, so a whole-course write would take hours a night at 300 students. Later items get their date as they come into the window.
  - **UI:** a pacing card on the course map (pace, today's goal, this week, chart), a Pace column and a Pace section with the chart and target date in the dashboard tray, and a Pacing panel on the setup screen (finish date, minutes per weekday for admins, days off). Course Pacing's tab is hidden in paced courses. Shared pieces are in `ui/shared/self-paced` (`pacing.ts`, `react/PaceBadge`, `react/PaceChart`).
  - **Not yet:** re-planning when Mastery Paths releases content (Phase 9) or when an enrollment's start date changes (the nightly re-spread picks up content changes, but the baseline keeps its start). Half days can be stored per date through the API; the setup screen only edits weekdays for now.

**Phase 5: Interventions.** Flag: `self_paced_interventions`.
- Every §2.5 tool, bulk actions, notes, messaging and the audit log.
- **Done 2026-09-24.** What was built:
  - **One path for every tool:** `SelfPaced::Intervener` checks the flag, that the student is in the course, that the item belongs to it and the tool's permissions, does the work and writes the `interventions` row in one transaction. Rows record the actor, the real user when masquerading, the item, the reason, a payload and the bulk job (`progress_id`). They are read-only once saved.
  - **Tools:** unlock (plus the quiz's own `manually_unlocked`), mark complete, exempt (excuses graded items; needs `manage_grades`), undo for all three, extra tries and reset last try on quizzes and limited-attempt assignments (`self_paced_manage_attempts` + `manage_grades`), finish date, notes and messages. A reset keeps the old try and logs its number and score.
  - **Finish date:** the Phase 4 pacing endpoint now goes through the same service, so date changes are logged too. It works without the interventions flag, as before.
  - **Review before retake:** a reset or extra tries given after a failed try waive the "reopen the lesson" rule for that try (§2.2). Staff have already decided the student may try again.
  - **Messages:** a private Conversations message from the course. The Mentor role now includes `send_messages`, which answers the "Messaging" question in §2.6: account-role mentors can message students through the normal Conversations path.
  - **Notes** (`student_notes`) belong to the student. Staff who can read notes in one of the student's classes see every note in the root account, with the class it was written from. Only the author can delete a note (soft delete, logged).
  - **Bulk:** `POST /api/v1/self_paced/interventions/bulk` runs the service for up to 500 (course, student) pairs in a `Progress` job. One failure doesn't stop the rest; failures are listed in the results. Item actions take one item id (students in one class) or `current`, each student's current item.
  - **API:** `GET/POST /api/v1/self_paced/courses/:course_id/students/:student_id/interventions` returns or runs the tools, with the log (latest 50) and notes. The drill-down's items gain `overrides`, `graded` and `attempts_limited` when the flag is on.
  - **UI:** in the student panel, a menu on each item (only the actions the viewer may use, with undo where an override exists), badges for overrides, a Message button in the header, a Notes card and a "Help given" history. Every action asks for confirmation and an optional reason. In the roster, checkboxes and a bulk bar: message, add note, and "extra try where stuck" (only classes where the student has 3+ tries on their current item). Messages and notes go once per student.
  - **Retention:** purging a student deletes the log and notes about them; rows they wrote as staff stay. Merges move both.
  - **Not yet:** a course-wide log view (comes with the Phase 7 "intervention log" report) and bulk item actions on one chosen item (comes with the Phase 5b course page, where all selected students share a course).

**Phase 5b: Course mentor page and Course Editor role** (added 2026-09-24; runs right after Phase 5). Flag: `self_paced_course_view`.
- **A page for each course**, at `/self_paced/courses/:course_id`, built for a mentor working with one class rather than the whole school:
  - **Course header** in the course's colour: name, students, the class's average progress, and how many are behind, stuck or inactive.
  - **Students** in that class only, with the same search and quick filters as the Students page. The per-class columns (working on, progress, pace, grade, tries) are shown directly, since there is no grouping across classes.
  - **Where the class is:** a heat map of units, showing how many students are on each unit and where they pile up or get stuck. Items where many students need several tries are listed so the mentor knows which lessons or checks need help.
  - **Course pace:** planned against actual progress for the whole class.
  - **Quick actions:** the Phase 5 tools (unlock, extra attempt, exempt, mark complete, note, message) work from this page, including on several selected students at once.
- **Links both ways:** the student panel on the Students page gets an "Open [course name]" link to this page, and each student on this page links back to their panel. The course chips in the roster link here too.
- **Course Editor role**, an account-level role like Mentor (§2.6), created with `SelfPaced::CourseEditorRole.ensure!(root_account)`:
  - everything a Mentor has (dashboard, live monitor, notes, unlock, pacing, read-only grades), plus the ability to **edit the course**: modules, pages, quizzes and assignments, the Course Player setup and the Pacing panel.
  - **Still not** granted: grading (`manage_grades`), enrolling or removing students, course deletion or account settings. Editors change content, not students' grades or enrolments.
  - Editors reach the editing screens from the course page: an "Edit course" button linking to the Course Player setup and to Canvas's own modules and pages.
  - The role sees every self-paced course in the schools it's granted on, like Mentor. A spec checks that an editor can edit modules but can't grade or change enrolments.
- **Answered 2026-09-24:** (1) editors get full editing, quiz questions and answer keys included; (2) editors see every self-paced course in the schools they're granted on, like mentors.
- **Done 2026-09-24.** What was built:
  - **Page:** `/self_paced/courses/:course_id` (`SelfPaced::DashboardController#course`), the same React bundle as the Students page with a `CourseApp` root. Only for courses in the viewer's `DashboardScope` with `self_paced_course_view` on.
  - **Header** in the course colour (the same colour as on the Students page: both number courses from the viewer's full course list), with students, average progress, and behind, stuck and inactive counts. Links to "All students" (filtered to the course) and, for editors, an "Edit course" menu: Course Player setup, Modules, Pages, Quizzes, Assignments, Files.
  - **Where the class is:** a tile per unit, shaded by how many students are on it, with the stuck count and how many finished it. Choosing a tile narrows the student table to that unit.
  - **Students:** the roster API takes `course_id`; search, quick filters, caseload, Live view, checkboxes and the tray all work as on the Students page. The bulk bar adds **Item action**: unlock, mark complete, exempt, extra tries or reset on one chosen item for every selected student (only the tools the viewer has).
  - **Items that take many tries** and **Class pace** (the average of the students' baselines and progress, drawn with the same chart as one student's pace) come from `GET /api/v1/self_paced/courses/:course_id/summary` (`SelfPaced::CourseSummary`).
  - **Links both ways:** course chips in the Students roster link to the course page; the student panel has "Open [course]"; on the course page it has "All their classes", which opens the Students page with that student's panel (`?student_id=`).
  - **Course Editor role:** `SelfPaced::CourseEditorRole.ensure!(root_account)` = the Mentor permissions plus content editing (`manage_course_content_*`, `manage_assignments_*`, `manage_wiki_*`, `manage_files_*`, `manage_rubrics`, `read_question_banks`). A spec checks that an editor can edit modules and quizzes but can't grade, enrol, add sections, delete the course or change account settings.

**Phase 6: Alerts (done 2026-09-24).** Flag: `self_paced_alerts`.
- **Rules:** `self_paced_alert_rules`, one per kind, for the school (no course) or for one course, which replaces the school's. Kinds: behind pace, stuck on an item, out of tries, inactive, low grade. With no rules, built-in defaults apply: behind 3 days, stuck 3 tries, out of tries, inactive 3 days, and low grade off (60%).
- **Evaluator:** `SelfPaced::AlertEvaluator`, run every 30 minutes for each tracked course. It reads the read model, opens an alert when a condition becomes true, resolves it when it stops, and tells the assigned mentor (or the course's teachers) once. Alerts staff dismiss stay quiet until the trouble has cleared once. A student who has never been active counts from when they were first tracked.
- **Notification:** one type, "Self Paced Alert" (category Grading), so each person controls email in their preferences.
- **API:** `GET /api/v1/self_paced/alerts`, `PUT .../alerts/:id/dismiss`, `GET|PUT /api/v1/courses/:id/self_paced/alert_rules` (changing rules needs `manage_grades`).
- **UI:** an "Alerts" card on the course page, with an "Alert rules" editor, and an "Alerts" widget for the educator home dashboard.

**Phase 7: Reports and attendance (done 2026-09-24).** Flag: `self_paced_reports`.
- **Reports** (`SelfPaced::Reports`, one class behind every export): progress, time on task, pacing, intervention log, engaged days. Time on task, the log and engaged days take a date range (default the last 30 days).
- **Teachers and mentors:** `GET /api/v1/self_paced/reports/:kind?course_id=&from=&to=` sends a CSV of the courses in their DashboardScope. Grades follow the viewer's rights (unposted, posted or blank). The course page has a "Download report" menu.
- **Admins:** five Account Reports ("Self-Paced Progress", "Time on Task", "Pacing", "Intervention Log", "Engaged Days") in `AccountReports::SelfPacedReports`, over every tracked course in the school.
- **Attendance (§2.10):** `attendance_policies` (versioned by `effective_on`: minimum active minutes, whether a submission counts) and `attendance_adjustments` (a logged correction with a reason, optional documented minutes; the newest for a day wins). `SelfPaced::Attendance` judges each day by the policy in force that day. There is a built-in default of 30 minutes with submissions counting when the school has no policy.
- **API only for now:** `GET|POST /api/v1/self_paced/attendance_policies` (admins write), `GET|POST /api/v1/courses/:id/self_paced/attendance_adjustments` (`manage_grades` writes). No screen yet.

**Staff course home (2026-09-25).** `/courses/:id` for teachers, TAs and admins of a Course Player course is now `ui/features/self_paced_course_home` (`SelfPaced::StaffCourseHome` in `CoursesController#show`, data from `SelfPaced::StaffHome`), with no sidebar. It shows the class at a glance (students, average progress, behind, stuck, inactive), a "Get the class ready" checklist that goes away when done, the units with item counts and unpublished warnings, and "Make something" and "Run the course" tiles, each limited to what the viewer may do. `?classic=1` opens the standard page. Students still go to the course map.

**Question layouts (2026-09-25).** Matching questions get a "How students answer" setting, `question_data.sylla_layout`: `ordering` (the right side holds the positions 1, 2, 3...; students order the items with arrow buttons) or `categorize` (the right side holds category names; students pick an item, then its category). It is one field on the classic matching question, so grading, statistics, the API and QTI export stay the standard matching ones. The take page (`ui/features/sylla_question_layouts`) draws the control over the standard selects, which stay in the form (hidden) and are kept in sync. An ordering question whose right side isn't exactly 1..N, or a categorize question with fewer than two categories, keeps the plain selects. Three more options followed. **Confidence**: any question can ask "How sure are you?" (question_data.sylla_confidence); the answer is posted as question_<id>_confidence and kept with the graded answer, and results show it with a nudge when the student was sure and wrong. **Units**: a numeric question can have a correct unit and unit choices (sylla_unit, sylla_unit_choices); it is right only with the right number and unit, and the correct unit is never sent to students. **Hotspot**: a multiple choice question can have an image and a region per choice (sylla_image, sylla_regions, one "Choice | left | top | width | height" line each, in percent); clicking a region picks the choice with the same text, and the choices list stays as a fallback. The editor previews the image and adds a region line when you drag on it.

**Skills page (2026-09-25).** `/courses/:id/outcomes` for staff of a Course Player course is `ui/features/self_paced_skills` (`SelfPaced::StaffSkills` in `OutcomesController#index`, data from `SelfPaced::Skills`, API `GET|POST /api/v1/courses/:id/self_paced/skills`), and the "Outcomes" tab is renamed "Skills". Each outcome is a skill. A student's level comes from their latest result: mastered (met the mastery score), almost there (at least 75% of it), still building, or not started. The page shows the class summary, each skill with a bar and counts, the students on it (weakest first, each linking to their panel), the items aligned to it, and an "Add a skill" form (standard four-level scale, mastery at 3). Skills where fewer than half of those assessed have mastered it are flagged and listed first. `?classic=1` opens the standard outcomes page, which is still where you align items and edit ratings.

**Phase 8: Observer view (done 2026-09-25).** Flag: `self_paced_observer_view`.
- **Page:** `/self_paced/observer` (and the home page for people who only observe; `/?classic=1` opens the usual dashboard). `SelfPaced::ObserverView` finds each (student, course) the observer is linked to by an observer enrollment, in a Course Player course with the flag on, where the student is still enrolled. Read only, and only ever the current user's own students.
- **Shows:** each class's progress and pace (days behind or ahead, planned finish, last active), time on task this week against last week, posted grades from the last 30 days, and open behind-pace and inactive alerts under "Worth a conversation". A parent with several students switches between them.
- **Alerts:** when the Phase 6 evaluator opens a behind-pace or inactive alert it also sends "Self Paced Observer Alert" to the student's observers, a separate notification type so parents choose email for it on their own. Stuck, out-of-tries and grade alerts stay with staff.
- **API:** `GET /api/v1/self_paced/observer`.

**Parent invites (2026-09-25).** A three-dot menu on each student in the Students page roster and on each row of the account People list (needs `self_paced_observer_view`) opens "Invite a parent (QR code)". `POST /api/v1/self_paced/students/:id/parent_invite` (`SelfPaced::ParentInvitesController`) makes Canvas's own observer pairing code (one use, expires in 7 days) and returns a link on the address the staff member is using, plus that link as an inline SVG QR code (`rqrcode`, drawn server side). The dialog shows the code, the link, and Copy link, Print and New code buttons. The link is `/parents/join/:code` (`SelfPaced::ParentSignupController`, `ui/features/self_paced_parent_signup`): a signed-out parent makes an account (name, email, password) and is signed in and linked as an observer; a signed-in parent gets "Add [student] to your account". It works whether or not the school has open self-registration on, says only the student's first name, and refuses a used or expired code. Who can make a code: staff who can see the student on the dashboard, and admins with `manage_students`.

**Phase 9: Test-out by skill (done 2026-09-25).** Flag: `self_paced_test_out` (course). Built on the Skills page instead of Mastery Paths, because Mastery Paths only reads one item's total score and can't see per-skill results.
- **Setup:** on the Units page a lesson or practice item gets a "Skill" picker (the course's own skills). It is `module_item_settings.learning_outcome_id`; checks and pretests can't have one, and turning an item into a check clears it.
- **Pretest:** any graded item whose results are per skill, like a rubric with a criterion for each skill or a quiz drawn from skill-aligned banks. Nothing new is built for it.
- **Trigger:** when a mastery result is saved (`SelfPaced::ModelHooks.outcome_result_committed`), a background job (`SelfPaced::TestOut.apply`) exempts the lessons that teach that skill for that student, as `exempt` item overrides with no `created_by`, the skill on the row (`module_item_student_overrides.learning_outcome_id`) and the reason "Tested out: mastered <skill>". They count as done and drop out of pacing. Saving the item settings also sweeps students who had mastered a skill before a lesson was tied to it.
- **One-way:** mastering a skill at any time keeps its lessons skipped, so a lower retake never gives them back. Staff can still undo an exemption from the student's panel. Graded items are never exempted this way, because that would excuse a grade.
- **Where it shows:** the student's course map says "Skipped: you already know this"; the Skills page says which lessons a skill skips and how many students have tested out.


**Phase 10 (optional): Cleanup (started 2026-09-25).** Remove the hosted-only features hidden in Phase 0 (§8). Each removal is its own commit, after a checkpoint commit of Phases 4 to 9.
- **Analytics Hub and Intelligent Insights (removed).** The `analytics_hub` tab, controller, service and remote module, the Canvas Course Criteria panel, the `analytics_hub` LTI placement, the `view_analytics_hub`, `view_ask_questions_*`, `view_students_in_need*`, `view_course_readiness`, `view_title_iv_financial_aid_report`, `view_rsi_report`, `view_accessibility_insights` and `view_advanced_analytics` permissions, and the flags for them. `analytics_2` and the `admin_analytics*` flags stay, because the old analytics tabs still use them.
- **Course Pacing (removed).** `CoursePace` and its module items, the `/courses/:id/course_pacing` page and API (`CoursePacesController`, `CoursePacing::*`), the pace-document report (`CourseReport` and its API, which only ever made that document), the account and course `enable_course_paces` settings, the tab, the `course_pace_*` flags, blueprint, course copy and import/export support for it, the "due dates are managed by Course Pacing" notices, and the Mastery Paths toggle that only appeared in paced courses (`@canvas/mastery-path-toggle`). Paced/unpaced statsd metrics went too. Mastery Paths itself stays. The calendar's "blackout date" checkbox now shows for account calendars only, because a course's blackout dates are managed on the self-paced Pacing page. Migration `20260925120000` drops `course_paces`, `course_pace_module_items` and `course_reports`. `ENV` types that lived next to Course Pacing's (`SECTIONS`, `COURSE_ID`, `MASTER_COURSE_DATA`, and so on) moved to `EnvCourseShared.d.ts`.
- **Canvas Career / Horizon (removed).** Career mode and everything that only served it: `CareerController`, `CareerExperienceController`, `HorizonController` (the convert-a-course-to-Career tool), the `HorizonMode` concern, `CanvasCareer::*` (experience resolver, config, label and permission overrides, user preferences, `canvas_career_user_experiences`), the `horizon_account` and `horizon_course` behavior in `Account`, `Course`, `User` and their APIs and GraphQL types, Learning Library courses (`career_learning_library_only` filters), estimated durations on module items (editor, API fields, the module info endpoint), the block content editor's Pine, Redwood and Content Service clients and `ExternalContentReference`, the bulk user API (`Account::BulkUpdate`, `manage_users_in_bulk`) and Autopilot `manage_rules_*` permissions, the Kafka event producer (`Canvas::KafkaEvents`), the microfrontend release-tag override, selective content-tag export, the copied-asset course filter, the Career theme and `career`/`horizon_toggle` UI features, and the `clx_feature_flags.yml` flags. Migration `20260925130000` drops `canvas_career_user_experiences` and `external_content_references`. Left in place on purpose: the `courses.horizon_course` and `career_learning_library_only` columns (unused, harmless), the `EstimatedDuration` model with its GraphQL fields, and the Ignite agent remote. `JOURNEY_URL` is no longer set, so the Notebook page renders nothing (its tab is already hidden).
- **New Quizzes (to do).**

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
- **Canvas Career / Horizon**: done in Phase 10.
- **Course Pacing**, if the new engine fully replaces it
- **Kinesis Live Events config**, if no outside consumer is planned
- **Renaming internal `Canvas` identifiers** (`Canvas::`, `@canvas/*`). The rebrand kept these for plugin compatibility, which no longer matters. It's a large, mechanical change, and only worth doing as its own project.

