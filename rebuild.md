docker compose down

docker compose down -v

docker rmi $(docker images -q)

docker compose up --build

docker compose run --rm web bash



bundle install
yarn install

rake db:create
rake db:migrate

yarn build:watch
yarn webpack
rails






You're working in a fork of Instructure's Canvas LMS (Ruby on Rails backend, React frontend). The goal is to turn it into a self-paced, mastery-based platform in the style of Edgenuity / Odysseyware, for semi-virtual 9-12 schools where students work through courses largely on their own and teachers/mentors monitor and intervene. Courses will be OER content imported into Canvas.

## How I want you to work

1. **Discovery first, no code yet.** Explore the codebase and write `docs/fork-plan.md` covering:
   - How modules, module item requirements/prerequisites, Mastery Paths, Course Pacing, New Quizzes/Classic Quizzes, page views, Live Events, and analytics currently work, with file paths.
   - Which existing features we can extend vs. what must be built new.
   - A proposed architecture that minimizes merge conflicts with upstream Canvas (prefer new Rails engines/plugins under `gems/plugins/`, new React bundles, feature flags, and additive migrations over editing core files).
   - A phased roadmap with the riskiest assumptions called out.
   Stop and wait for my review after writing the plan.

2. **Then build phase by phase**, each behind its own feature flag, with tests (RSpec + Jest) and a short summary of what changed and how to try it locally.

## Features

### A. Student course player
- A focused, sequential "course player" view that replaces the standard course navigation for flagged courses: one activity at a time, clear next/previous, progress bar, and a course map.
- Lesson structure: instruction (video/reading) → guided practice → graded check (quiz), with configurable gating so the next item unlocks only after mastery (configurable threshold, e.g. 70%).
- Video items can require full viewing before "complete."
- Retake rules per assessment: number of attempts, required review before retake, teacher unlock after max attempts.
- Optional pretest/test-out: a student who scores above a threshold on a unit pretest can skip the corresponding lessons (build on Mastery Paths if feasible).
- Student-facing pacing: "you are X days ahead/behind," today's target, and a weekly goal.

### B. Pacing engine
- Auto-generate a per-student pacing calendar from enrollment start date, target end date, school calendar (non-instructional days), and item weights/estimated minutes.
- Recalculate when dates change or a teacher adjusts the plan. Reuse Canvas Course Pacing where it fits; document where it doesn't.

### C. Teacher dashboard (dedicated UI, the core of this project)
- **Roster overview:** every student across all of a teacher's self-paced courses, with sortable columns for current activity, % complete, on/behind pace (days), current grade, last active, time on task (today/week), and number of failed attempts on current item.
- **Live monitoring view:** who is online right now, what item they're on, how long they've been on it, and an idle flag (no meaningful interaction for a configurable number of minutes). Near-real-time updates (polling is fine to start; note if Live Events or websockets would be better).
- **Alerts:** configurable rules, e.g. behind pace by N days, stuck on an item > N minutes, max attempts reached, inactive N days, grade below threshold. Show in dashboard and optionally email.
- **Student drill-down:** full activity timeline, attempt history with scores, time per item, pacing chart (planned vs. actual).
- **Intervention tools** (all logged with who/when/why): unlock an item, grant extra attempts, reset an attempt, mark item exempt/complete, adjust target end date, add a note to the student record, send a message.
- **Bulk actions** across selected students.
- Works for teachers and a separate "mentor" role (on-site staff who monitor but may not grade).

### D. Reporting
- Exportable (CSV) reports: progress by course, time on task by date range, pacing status, intervention log, and an attendance/participation-style report showing days with active engagement per student. Design the attendance data model to be flexible, because state pupil accounting rules for virtual/semi-virtual instruction have specific requirements I'll configure later.

### E. Parent/observer view
- Simplified read-only view for observers: progress, pacing status, recent grades, time on task.

## Constraints
- Student data is FERPA-covered: respect existing Canvas permissions, add new permissions for the dashboard/mentor role rather than bypassing them, and don't log more activity detail than the features need.
- Activity tracking should derive from existing page views/submissions/Live Events where possible rather than adding heavy new client-side tracking.
- Keep the UI consistent with the new material 1 theming.
- Note any performance concerns (e.g. dashboard queries across hundreds of students) and propose indexes or caching.

Start with the discovery plan.

