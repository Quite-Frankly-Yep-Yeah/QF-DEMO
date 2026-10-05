# Onboarding: plan and status

Onboarding for installers, administrators, teachers and students. The working
plan is the project's Onboarding Plan doc; this file records what is built.

| Phase | What | Flag | Status |
| --- | --- | --- | --- |
| 1 | Framework: per-step progress, checklist panel, Help menu links | `qf_onboarding` | Built |
| 2 | Installer: `docs/install.md`, `/install_status`, `rake qf:demo_data` | none | Built |
| 3 | Administrator setup checklist and tour | `qf_onboarding_admin` | Not started |
| 4 | Teacher course-setup checklist, tour and tutorial trays | `qf_onboarding_teacher` | Not started |
| 5 | Student welcome and course-player walkthrough | `qf_onboarding_student` | Not started |
| 6 | Completion report, accessibility and translation pass | none | Not started |

## How it fits together

- **Tracks and steps** (`app/services/onboarding/tracks.rb`). A track is one
  role's checklist and a step is one thing to do, with a page to do it on.
  Tracks are listed in `Onboarding::Tracks.all`; each says who it is for. A
  step with a `check` is ticked by the system while the check passes.
- **Progress** (`onboarding_progresses`, `Onboarding::Progress`). One row per
  person, school and step that someone marked done or set aside by hand.
  Detected steps need no row.
- **API** (`Onboarding::ProgressController`), for the signed-in person only:
  - `GET /api/v1/users/self/onboarding` lists their tracks with counts
  - `GET /api/v1/users/self/onboarding/:track` returns the steps
  - `PUT /api/v1/users/self/onboarding/:track/steps/:step` takes `done` and `dismissed`
  - `DELETE /api/v1/users/self/onboarding/:track` starts the track over
- **UI.** `@canvas/onboarding-checklist` renders any track. When `qf_onboarding`
  is on, the Help menu lists each of the person's tracks with its progress.

## Phase 2: the installer track

`/install_status` is for site admins and works without `qf_onboarding`, so a
fresh install can reach it before any flag is on. It checks the domain, outgoing
mail, background jobs, the self-paced flag, and whether anyone is enrolled; the
Anthropic key and demo data are optional. See `Onboarding::InstallTrack`.

## Adding a role's track (Phases 3 to 5)

1. Add a module like `Onboarding::InstallTrack` with `build(root_account)`,
   returning a `Tracks::Track` whose `available` lambda checks the role and the
   role's flag.
2. Add it to `Onboarding::Tracks.all`.
3. Point its `url` at the page that shows the checklist, or embed
   `OnboardingChecklist` on an existing page.

The upstream product tours (`ui/features/nav_tourpoints`) are left as they are
for now. Their copy and selectors get rewritten with each role's phase.
