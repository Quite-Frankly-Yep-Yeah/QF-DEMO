# Grading Queue (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page and API where a teacher sees the ungraded work in every course they grade, ranked so the work holding students back comes first, plus a grading-turnaround number and a `grading_backlog` alert for admins.

**Architecture:** One service, `TeacherWorkflow::GradingQueue`, computes everything on read (no queue table): it finds the viewer's gradeable courses, runs `Submission.needs_grading` per course, tags each row with a tier using the `student_course_states` read model and module order, sorts by tier then oldest first, and pages the result. A thin API controller and a React page sit on top of it. The backlog alert is a periodic job with its own small table.

**Tech Stack:** Rails 8 / RSpec, Postgres, React + InstUI + Vitest, Delayed Jobs periodic cron.

**Spec:** `docs/superpowers/specs/2026-10-01-grading-queue-design.md` (source plan: `docs/teacher-workflow-plan.md` §2.8, §3.5, §5 Phase 3)

## Global Constraints

- Namespace is `TeacherWorkflow`, never `Workflow`: the `workflow` gem defines a top-level `Workflow` module that Canvas models `include`.
- URLs and API paths say workflow: page `/workflow/grading`, API `GET /api/v1/workflow/grading_queue`. UI bundle `workflow_grading_queue`, in `ui/features/workflow_grading_queue`.
- Flag `workflow_grading_queue` (Account, hidden) sits under the existing `teacher_workflow` (RootAccount) umbrella. Flag off means 404.
- Ranking: tier 1 blocked, tier 2 could re-lock, tier 3 due within 72 hours (calendar time), tier 4 everything else. Oldest `submitted_at` first within a tier.
- Only people with `manage_grades` in a course see its rows. Students, observers, mentors and Course Editors see nothing.
- Scan cap 500 rows; page size 25; cache 60 seconds per viewer and filter set.
- Anonymous assignments with unposted grades show "Anonymous student" and are left out of the student filter.
- Backlog threshold: account setting `grading_backlog_days`, default 5 school days. Notifies school admins holding `self_paced_manage_alert_rules`, once per opened alert. Never teachers.
- New files carry the AGPL header used by neighbours (copy it from `app/services/self_paced/gating.rb`, credit "quite frankly an example LMS contributors", year 2026).
- Commands run in the web container per `AGENTS.md`: `docker compose run --rm web bin/rspec <path>` and `docker compose run --rm web yarn test:vitest <path>`. Below, `bin/rspec` and `yarn test:vitest` mean that.
- Git: `app/controllers/application_controller.rb`, `app/views/shared/_new_nav_header.html.erb` and `ui/features/navigation_header/react/SideNav.tsx` already have **uncommitted edits from other work**. Never `git add -A` or `git add <those files>` whole. Stage only our hunks with `git add -p`.
- Commit messages: lines under 60 characters, the why, then `flag=workflow_grading_queue`, a `test plan:` block, and the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not touch a ChangeId line a hook adds.

## Review Focus

Inputs and conditions the spec implies that nothing else in the plan's happy-path tasks would catch. Each has a test in the task named in brackets.

1. A teacher who is also a student in some other course must not see that course's work, and a student with no teaching enrollment gets an empty queue, not an error. [Task 2]
2. A section-limited TA must not see submissions from students in other sections. [Task 2, Task 4]
3. A submission whose assignment is not in any module (no content tag) must still appear, in tier 3 or 4, with no unit. [Task 3, Task 4]
4. A student with no `student_course_states` row (never tracked) must not crash the ranker, and just falls to tier 3 or 4. [Task 3]
5. A quiz attempt must be one row, not one per attempt, and a graded-and-regraded submission must not appear as ungraded. [Task 4]
6. An anonymous, unposted assignment must not leak the student's name or id through the row, the reason text, or the SpeedGrader link. [Task 4]
7. A course with zero waiting work must produce no backlog alert, and a backlog that clears must resolve its open alert exactly once. [Task 8]

---

## File Structure

| File | Responsibility |
|---|---|
| `app/models/teacher_workflow.rb` | Namespace: flag list, `enabled?`, `feature_enabled?`, `queue_available?` |
| `config/feature_flags/teacher_workflow.yml` | Add `workflow_grading_queue` |
| `app/services/teacher_workflow/grading_queue/courses.rb` | Which courses a viewer can grade, and which students they may see in each |
| `app/services/teacher_workflow/grading_queue/item_index.rb` | Assignment id to module item, unit and module order |
| `app/services/teacher_workflow/grading_queue/tiering.rb` | Pure tier + reason decision for one row |
| `app/services/teacher_workflow/grading_queue.rb` | The query, rows, sorting, paging, cache, tier counts |
| `app/services/teacher_workflow/grading_turnaround.rb` | Median grading time per course for the viewer |
| `app/controllers/teacher_workflow/grading_queue_controller.rb` | API + page |
| `config/routes.rb` | Page and API routes |
| `ui/features/workflow_grading_queue/` | Bundle, app, types, tests |
| `ui/featureBundles.ts` | Register the bundle |
| `app/models/teacher_workflow/backlog_alert.rb`, migration | Backlog alert table and model |
| `app/services/teacher_workflow/backlog_evaluator.rb` | Periodic job that opens and resolves backlog alerts |
| `app/messages/grading_backlog.*.erb` | Notification templates |
| `app/models/account.rb`, `config/initializers/periodic_jobs.rb` | Setting and cron line |
| `spec/...` | Mirrors the files above |

---

### Task 1: Namespace and flag

**Files:**
- Create: `app/models/teacher_workflow.rb`
- Modify: `config/feature_flags/teacher_workflow.yml`
- Test: `spec/models/teacher_workflow_spec.rb`

**Interfaces:**
- Produces: `TeacherWorkflow.enabled?(context)`, `TeacherWorkflow.feature_enabled?(context, flag)` (context is an Account or Course; flag one of `PHASE_FLAGS`), `TeacherWorkflow::PHASE_FLAGS`.

- [ ] **Step 1: Write the failing test**

```ruby
# frozen_string_literal: true

# (AGPL header)
describe TeacherWorkflow do
  let_once(:course) { course_factory(active_all: true) }

  describe ".feature_enabled?" do
    it "is false until the umbrella and the phase flag are both on" do
      expect(described_class.feature_enabled?(course, :workflow_grading_queue)).to be false

      course.account.enable_feature!(:workflow_grading_queue)
      expect(described_class.feature_enabled?(course, :workflow_grading_queue)).to be false

      course.root_account.enable_feature!(:teacher_workflow)
      expect(described_class.feature_enabled?(course, :workflow_grading_queue)).to be true
    end

    it "works for an account" do
      course.root_account.enable_feature!(:teacher_workflow)
      course.account.enable_feature!(:workflow_grading_queue)
      expect(described_class.feature_enabled?(course.account, :workflow_grading_queue)).to be true
    end

    it "rejects an unknown flag" do
      expect { described_class.feature_enabled?(course, :nope) }.to raise_error(ArgumentError)
    end
  end
end
```

- [ ] **Step 2: Run it to see it fail**

Run: `bin/rspec spec/models/teacher_workflow_spec.rb`
Expected: FAIL, `uninitialized constant TeacherWorkflow`.

- [ ] **Step 3: Add the flag**

Append to `config/feature_flags/teacher_workflow.yml`:

```yaml
workflow_grading_queue:
  applies_to: Account
  state: hidden
  display_name: "Teacher Workflow: Grading Queue"
  description: |-
    One page that lists the grading a teacher can do across their courses,
    ranked so the work that holds students back comes first, with a grading
    turnaround number and a backlog alert for admins.
```

- [ ] **Step 4: Write the module**

```ruby
# frozen_string_literal: true

# (AGPL header)

# Namespace for the teacher workflow tools: the grading queue, follow-ups, the
# student page and progress reports (docs/teacher-workflow-plan.md, Track W).
# Named TeacherWorkflow because the workflow gem owns a top-level Workflow.
module TeacherWorkflow
  UMBRELLA_FLAG = :teacher_workflow

  # The feature flags for each phase, in the order they ship.
  PHASE_FLAGS = %i[
    workflow_grading_queue
  ].freeze

  # Whether the teacher workflow tools are on for the root account that owns
  # +context+ (an Account, a Course, or anything else with a root account).
  def self.enabled?(context)
    root_account = context.is_a?(Account) ? context.root_account : context&.root_account
    !!root_account&.feature_enabled?(UMBRELLA_FLAG)
  end

  # Whether a phase flag is on for +context+ (an Account or a Course). Always
  # false while the umbrella flag is off.
  def self.feature_enabled?(context, flag)
    raise ArgumentError, "unknown teacher workflow flag: #{flag}" unless PHASE_FLAGS.include?(flag)
    return false unless enabled?(context)

    account = context.is_a?(Course) ? context.account : context
    account.feature_enabled?(flag)
  end
end
```

- [ ] **Step 5: Run it to see it pass**

Run: `bin/rspec spec/models/teacher_workflow_spec.rb`
Expected: PASS (3 examples).

- [ ] **Step 6: Commit**

```bash
git add app/models/teacher_workflow.rb config/feature_flags/teacher_workflow.yml spec/models/teacher_workflow_spec.rb
git commit
```
Message: `add the teacher workflow namespace and grading queue flag`, with the flag line, test plan, and trailer from Global Constraints.

---

### Task 2: Which courses and students a viewer may grade

**Files:**
- Create: `app/services/teacher_workflow/grading_queue/courses.rb`
- Test: `spec/services/teacher_workflow/grading_queue/courses_spec.rb`

**Interfaces:**
- Consumes: `TeacherWorkflow.feature_enabled?` (Task 1).
- Produces: `TeacherWorkflow::GradingQueue::Courses.for(viewer, course_id: nil)` returning an array of `Courses::Entry = Struct.new(:course, :student_ids, keyword_init: true)`, one per course the viewer may grade, with the queue flag on, and `student_ids` limited to the students the viewer can see in that course. With `course_id`, only that course (or `[]`).

- [ ] **Step 1: Write the failing test**

```ruby
describe TeacherWorkflow::GradingQueue::Courses do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }

  before do
    course.root_account.enable_feature!(:teacher_workflow)
    course.account.enable_feature!(:workflow_grading_queue)
  end

  def entries(viewer, **opts)
    described_class.for(viewer, **opts)
  end

  it "returns the teacher's course with its students" do
    entry = entries(teacher).sole
    expect(entry.course).to eq course
    expect(entry.student_ids).to eq [student.id]
  end

  it "returns nothing for a student" do
    expect(entries(student)).to eq []
  end

  it "does not return a course where the teacher is only a student" do
    other = course_factory(active_all: true)
    student_in_course(course: other, user: teacher, active_all: true)
    other.account.enable_feature!(:workflow_grading_queue)

    expect(entries(teacher).map(&:course)).to eq [course]
  end

  it "returns nothing while the flag is off" do
    course.account.disable_feature!(:workflow_grading_queue)
    expect(entries(teacher)).to eq []
  end

  it "limits a section-limited TA to their own section" do
    other_section = course.course_sections.create!(name: "Other")
    other_student = student_in_course(course:, section: other_section, active_all: true).user
    ta = ta_in_course(course:, active_all: true).user
    Enrollment.where(user: ta, course:).update_all(limit_privileges_to_course_section: true,
                                                   course_section_id: course.default_section.id)

    expect(entries(ta).sole.student_ids).to eq [student.id]
    expect(entries(ta).sole.student_ids).not_to include(other_student.id)
  end

  it "narrows to one course with course_id" do
    expect(entries(teacher, course_id: course.id).map(&:course)).to eq [course]
    expect(entries(teacher, course_id: 0)).to eq []
  end
end
```

- [ ] **Step 2: Run it to see it fail**

Run: `bin/rspec spec/services/teacher_workflow/grading_queue/courses_spec.rb`
Expected: FAIL, `uninitialized constant TeacherWorkflow::GradingQueue`.

- [ ] **Step 3: Implement**

```ruby
# frozen_string_literal: true

# (AGPL header)

module TeacherWorkflow
  class GradingQueue
    # The courses a viewer may grade (manage_grades through an active teacher
    # or TA enrollment, or admin rights on a course they name), with the
    # students they may see in each. Section-limited TAs only see their own
    # sections. Courses without the queue flag are left out.
    class Courses
      Entry = Struct.new(:course, :student_ids, keyword_init: true)

      GRADER_TYPES = %w[TeacherEnrollment TaEnrollment].freeze

      def self.for(viewer, course_id: nil)
        new(viewer, course_id:).entries
      end

      def initialize(viewer, course_id: nil)
        @viewer = viewer
        @course_id = course_id
      end

      def entries
        return [] unless @viewer

        courses.filter_map do |course|
          next unless TeacherWorkflow.feature_enabled?(course, :workflow_grading_queue)
          next unless course.grants_right?(@viewer, :manage_grades)

          Entry.new(course:, student_ids: course.students_visible_to(@viewer).pluck(:id))
        end
      end

      private

      def courses
        ids = @viewer.enrollments.active_or_pending
                     .where(type: GRADER_TYPES)
                     .joins(:course).merge(Course.active)
                     .pluck(:course_id)
        # naming a course lets an admin who doesn't teach it ask for it;
        # manage_grades below decides whether they may
        ids = [@course_id.to_i] if @course_id.present?
        Course.where(id: ids).preload(:root_account, :account).to_a
      end
    end
  end
end
```

Note: the admin case (viewer names a course they administer but doesn't teach) works because `@course_id` is added to the candidate ids and then `grants_right?(:manage_grades)` decides. Without `course_id`, admins who don't teach get nothing, by design (their reach is too large to list).

- [ ] **Step 4: Run it to see it pass**

Run: `bin/rspec spec/services/teacher_workflow/grading_queue/courses_spec.rb`
Expected: PASS. If the section-limited TA example fails because `students_visible_to` ignores the update, create the TA with `ta_in_course(course:, active_all: true, section: course.default_section, limit_privileges_to_course_section: true)` instead and keep the assertions.

- [ ] **Step 5: Commit** the two files. Message: `find the courses and students a teacher may grade`.

---

### Task 3: Module-item index and the tier decision

**Files:**
- Create: `app/services/teacher_workflow/grading_queue/item_index.rb`, `app/services/teacher_workflow/grading_queue/tiering.rb`
- Test: `spec/services/teacher_workflow/grading_queue/item_index_spec.rb`, `spec/services/teacher_workflow/grading_queue/tiering_spec.rb`

**Interfaces:**
- Produces:
  - `ItemIndex.new(course)`; `#for_assignment(assignment)` returns an `ItemIndex::Item = Struct.new(:tag, :unit_id, :unit_name, :order, :grade_requirement, keyword_init: true)` or `nil`. `order` is `[module position, item position]`. `grade_requirement` is true when the module item's requirement is `min_percentage` or `min_score`.
  - `Tiering.call(due_at:, item:, current_item:, player:, provisional:, now:)` returns an integer 1..4. `current_item` is an `ItemIndex::Item` or nil. `Tiering::DUE_SOON = 72.hours`.

- [ ] **Step 1: Write the failing tests**

`tiering_spec.rb` (pure, no database):

```ruby
describe TeacherWorkflow::GradingQueue::Tiering do
  Item = TeacherWorkflow::GradingQueue::ItemIndex::Item
  let(:now) { Time.zone.parse("2026-10-01 12:00:00 UTC") }
  let(:check) { Item.new(tag: nil, unit_id: 1, unit_name: "U1", order: [1, 2], grade_requirement: true) }
  let(:later) { Item.new(tag: nil, unit_id: 1, unit_name: "U1", order: [1, 3], grade_requirement: false) }

  def tier(**args)
    described_class.call(due_at: nil, item: check, current_item: nil, player: true, provisional: false, now:, **args)
  end

  it "is 1 when the student is stuck on this item and the course is not provisional" do
    expect(tier(current_item: check)).to eq 1
  end

  it "is 2 when provisional and the student has moved past this item" do
    expect(tier(provisional: true, current_item: later)).to eq 2
  end

  it "is not 2 when the item has no grade requirement" do
    ungated = check.dup.tap { |i| i.grade_requirement = false }
    expect(tier(item: ungated, provisional: true, current_item: later)).to eq 4
  end

  it "is 3 when due within 72 hours or already overdue" do
    expect(tier(due_at: now + 71.hours)).to eq 3
    expect(tier(due_at: now - 2.days)).to eq 3
    expect(tier(due_at: now + 73.hours)).to eq 4
  end

  it "ignores the self-paced tiers outside player courses" do
    expect(tier(player: false, current_item: check)).to eq 4
  end

  it "does not crash with no item and no current item" do
    expect(tier(item: nil, current_item: nil)).to eq 4
  end
end
```

`item_index_spec.rb`:

```ruby
describe TeacherWorkflow::GradingQueue::ItemIndex do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:mod) { course.context_modules.create!(name: "Unit 1") }
  let_once(:assignment) { course.assignments.create!(title: "Check", points_possible: 10, submission_types: "online_text_entry") }
  let_once(:tag) { mod.add_item(type: "assignment", id: assignment.id) }

  it "finds the module item, unit and order for an assignment" do
    item = described_class.new(course).for_assignment(assignment)
    expect(item.tag).to eq tag
    expect(item.unit_name).to eq "Unit 1"
    expect(item.order).to eq [mod.position, tag.position]
    expect(item.grade_requirement).to be false
  end

  it "reports a min_percentage requirement as a grade requirement" do
    mod.completion_requirements = [{ id: tag.id, type: "min_percentage", min_percentage: 70 }]
    mod.save!
    expect(described_class.new(course.reload).for_assignment(assignment).grade_requirement).to be true
  end

  it "finds a quiz's item through the quiz's assignment" do
    quiz = course.quizzes.create!(title: "Quiz", quiz_type: "assignment")
    quiz.publish!
    quiz_tag = mod.add_item(type: "quiz", id: quiz.id)
    expect(described_class.new(course).for_assignment(quiz.reload.assignment).tag).to eq quiz_tag
  end

  it "returns nil for an assignment that is in no module" do
    other = course.assignments.create!(title: "Loose", points_possible: 1)
    expect(described_class.new(course).for_assignment(other)).to be_nil
  end
end
```

- [ ] **Step 2: Run them to see them fail**

Run: `bin/rspec spec/services/teacher_workflow/grading_queue/`
Expected: FAIL, uninitialized constants `ItemIndex` and `Tiering`.

- [ ] **Step 3: Implement `ItemIndex`**

```ruby
# frozen_string_literal: true

# (AGPL header)

module TeacherWorkflow
  class GradingQueue
    # Maps a course's assignments to their module items, built once per course
    # per request. A quiz or graded discussion is found through the assignment
    # it owns. Items outside any module map to nil.
    class ItemIndex
      Item = Struct.new(:tag, :unit_id, :unit_name, :order, :grade_requirement, keyword_init: true)

      GRADE_REQUIREMENTS = %w[min_percentage min_score].freeze

      def initialize(course)
        @course = course
      end

      def for_assignment(assignment)
        by_assignment_id[assignment.id]
      end

      # The item for a ContentTag (used for the student's current item).
      def for_tag_id(tag_id)
        items_by_tag_id[tag_id]
      end

      private

      def items_by_tag_id
        @items_by_tag_id ||= tags.index_by(&:id).transform_values { |tag| build(tag) }
      end

      def by_assignment_id
        @by_assignment_id ||= begin
          quiz_assignments = Quizzes::Quiz.where(id: ids_of("Quizzes::Quiz")).pluck(:id, :assignment_id).to_h
          topic_assignments = DiscussionTopic.where(id: ids_of("DiscussionTopic")).pluck(:id, :assignment_id).to_h
          tags.each_with_object({}) do |tag, map|
            assignment_id = case tag.content_type
                            when "Assignment" then tag.content_id
                            when "Quizzes::Quiz" then quiz_assignments[tag.content_id]
                            when "DiscussionTopic" then topic_assignments[tag.content_id]
                            end
            map[assignment_id] ||= items_by_tag_id[tag.id] if assignment_id
          end
        end
      end

      def tags
        @tags ||= @course.context_module_tags.not_deleted.preload(:context_module).to_a
      end

      def ids_of(content_type)
        tags.select { |tag| tag.content_type == content_type }.map(&:content_id)
      end

      def build(tag)
        context_module = tag.context_module
        requirement = Array(context_module.completion_requirements).find { |r| r[:id].to_i == tag.id }
        Item.new(tag:,
                 unit_id: context_module.id,
                 unit_name: context_module.name,
                 order: [context_module.position.to_i, tag.position.to_i],
                 grade_requirement: GRADE_REQUIREMENTS.include?(requirement&.dig(:type).to_s))
      end
    end
  end
end
```

- [ ] **Step 4: Implement `Tiering`**

```ruby
# frozen_string_literal: true

# (AGPL header)

module TeacherWorkflow
  class GradingQueue
    # Which of the four tiers a waiting submission belongs to
    # (docs/superpowers/specs/2026-10-01-grading-queue-design.md). Pure: it
    # only looks at what it is given.
    module Tiering
      BLOCKED = 1
      COULD_RELOCK = 2
      DUE_SOON = 3
      OTHER = 4

      DUE_SOON_WINDOW = 72.hours

      def self.call(due_at:, item:, current_item:, player:, provisional:, now:)
        if player && item&.grade_requirement && current_item
          return BLOCKED if !provisional && current_item.order == item.order && current_item.unit_id == item.unit_id
          return COULD_RELOCK if provisional && (current_item.order <=> item.order) == 1
        end
        return DUE_SOON if due_at && due_at <= now + DUE_SOON_WINDOW

        OTHER
      end
    end
  end
end
```

- [ ] **Step 5: Run to see them pass**

Run: `bin/rspec spec/services/teacher_workflow/grading_queue/`
Expected: PASS. Note: `order` comparison across different modules is by module position first, so an item in a later module counts as "moved past".

- [ ] **Step 6: Commit.** Message: `rank waiting grading by how much it holds a student up`.

---

### Task 4: The queue service

**Files:**
- Create: `app/services/teacher_workflow/grading_queue.rb`
- Test: `spec/services/teacher_workflow/grading_queue_spec.rb`

**Interfaces:**
- Consumes: `Courses.for`, `ItemIndex#for_assignment` / `#for_tag_id`, `Tiering.call`, `SelfPaced::Gating.player_course?` / `.provisional?`, `SelfPaced::StudentCourseState`.
- Produces: `TeacherWorkflow::GradingQueue.new(viewer, course_id: nil, unit_id: nil, student_id: nil, held_up: false, page: 1, now: Time.zone.now).result` returning a hash:
  `{ rows: [Row hash], page:, per_page:, total:, truncated:, tier_counts: {1=>n,2=>n,3=>n,4=>n} }`
  where each row is `{ id:, tier:, reason:, student: {id:, name:} | {id: nil, name: "Anonymous student"}, course: {id:, name:}, unit: {id:, name:} | nil, item: {id:, title:}, submitted_at:, due_at:, speed_grader_url: }` (ids are strings, times ISO 8601).
  Constants `GradingQueue::SCAN_CAP = 500`, `PER_PAGE = 25`.

- [ ] **Step 1: Write the failing test**

Cover: one row per waiting submission with a student name and SpeedGrader URL; oldest first within a tier; tier order; `held_up` filter; `student_id` filter; `unit_id` filter; section-limited TA; no module item; no state row; quiz attempt is one row; regraded submission not listed; anonymous leak; empty for a student; truncation at the cap (stub `SCAN_CAP` to 2); paging.

```ruby
describe TeacherWorkflow::GradingQueue do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:ryan) { student_in_course(course:, active_all: true, name: "Ryan Cole").user }
  let_once(:mod) { course.context_modules.create!(name: "Unit 1") }
  let_once(:check) { course.assignments.create!(title: "Check 1", points_possible: 10, submission_types: "online_text_entry") }
  let_once(:check_tag) { mod.add_item(type: "assignment", id: check.id) }
  let(:now) { Time.zone.parse("2026-10-01 12:00:00 UTC") }

  before do
    course.root_account.enable_feature!(:teacher_workflow)
    course.account.enable_feature!(:workflow_grading_queue)
  end

  def submit(assignment, user, at:)
    assignment.submit_homework(user, submission_type: "online_text_entry", body: "work", submitted_at: at)
  end

  def queue(viewer = teacher, **opts)
    described_class.new(viewer, now:, **opts).result
  end

  it "lists a waiting submission with the student, item and a SpeedGrader link" do
    submission = submit(check, maya, at: now - 2.days)
    row = queue[:rows].sole

    expect(row[:id]).to eq submission.id.to_s
    expect(row[:student]).to eq({ id: maya.id.to_s, name: "Maya Lopez" })
    expect(row[:item][:title]).to eq "Check 1"
    expect(row[:unit][:name]).to eq "Unit 1"
    expect(row[:speed_grader_url]).to eq "/courses/#{course.id}/gradebook/speed_grader?assignment_id=#{check.id}&student_id=#{maya.id}"
  end

  it "puts the oldest first within a tier" do
    newer = submit(check, maya, at: now - 1.day)
    older = submit(check, ryan, at: now - 3.days)
    expect(queue[:rows].map { |r| r[:id] }).to eq [older.id.to_s, newer.id.to_s]
  end

  it "ranks a blocked student above an older, unblocked one" do
    allow(SelfPaced::Gating).to receive_messages(player_course?: true, provisional?: false)
    mod.update!(completion_requirements: [{ id: check_tag.id, type: "min_percentage", min_percentage: 70 }])
    other = course.assignments.create!(title: "Other", points_possible: 5, submission_types: "online_text_entry")
    submit(other, ryan, at: now - 5.days)
    blocked = submit(check, maya, at: now - 1.day)
    SelfPaced::StudentCourseState.create!(course:, user: maya, root_account: course.root_account, current_content_tag: check_tag)

    rows = queue[:rows]
    expect(rows.first[:id]).to eq blocked.id.to_s
    expect(rows.first[:tier]).to eq 1
    expect(rows.first[:reason]).to match(/waiting on this to move on/)
  end

  it "filters to held-up work, one student, and one unit" do
    allow(SelfPaced::Gating).to receive_messages(player_course?: true, provisional?: false)
    mod.update!(completion_requirements: [{ id: check_tag.id, type: "min_percentage", min_percentage: 70 }])
    held = submit(check, maya, at: now - 1.day)
    submit(check, ryan, at: now - 2.days)
    SelfPaced::StudentCourseState.create!(course:, user: maya, root_account: course.root_account, current_content_tag: check_tag)

    expect(queue(held_up: true)[:rows].map { |r| r[:id] }).to eq [held.id.to_s]
    expect(queue(student_id: ryan.id)[:rows].size).to eq 1
    expect(queue(unit_id: mod.id)[:rows].size).to eq 2
    expect(queue(unit_id: 0)[:rows]).to be_empty
  end

  it "lists work that is in no module, and students with no tracked state" do
    loose = course.assignments.create!(title: "Loose", points_possible: 1, submission_types: "online_text_entry")
    submit(loose, maya, at: now - 1.day)
    row = queue[:rows].sole
    expect(row[:unit]).to be_nil
    expect(row[:tier]).to eq 4
  end

  it "is one row for a quiz attempt, and none once it is graded" do
    quiz = course.quizzes.create!(title: "Quiz", quiz_type: "assignment", points_possible: 5)
    quiz.quiz_questions.create!(question_data: { question_type: "essay_question", question_text: "Why?", points_possible: 5, name: "q" })
    quiz.generate_quiz_data
    quiz.publish!
    submission = quiz.generate_submission(maya)
    submission.update!(submission_data: { "question_#{quiz.quiz_questions.first.id}" => "because" })
    Quizzes::SubmissionGrader.new(submission).grade_submission

    expect(queue[:rows].count { |r| r[:item][:title] == "Quiz" }).to eq 1

    quiz.assignment.grade_student(maya, grade: 5, grader: teacher)
    expect(queue[:rows].count { |r| r[:item][:title] == "Quiz" }).to eq 0
  end

  it "hides the student on anonymous, unposted work" do
    anon = course.assignments.create!(title: "Anon", points_possible: 5, submission_types: "online_text_entry",
                                      anonymous_grading: true, muted: true)
    anon.ensure_post_policy(post_manually: true)
    submission = submit(anon, maya, at: now - 1.day)
    row = queue[:rows].find { |r| r[:item][:title] == "Anon" }

    expect(row[:student]).to eq({ id: nil, name: "Anonymous student" })
    expect(row.to_json).not_to include("Maya")
    expect(row.to_json).not_to include(maya.id.to_s)
    expect(row[:speed_grader_url]).to include("anonymous_id=#{submission.anonymous_id}")
    expect(queue(student_id: maya.id)[:rows].map { |r| r[:item][:title] }).not_to include("Anon")
  end

  it "is empty for a student" do
    submit(check, maya, at: now - 1.day)
    expect(queue(maya)[:rows]).to eq []
  end

  it "keeps a section-limited TA to their section" do
    other_section = course.course_sections.create!(name: "Other")
    other = student_in_course(course:, section: other_section, active_all: true).user
    ta = ta_in_course(course:, active_all: true, limit_privileges_to_course_section: true,
                      section: course.default_section).user
    submit(check, maya, at: now - 1.day)
    submit(check, other, at: now - 2.days)
    expect(queue(ta)[:rows].map { |r| r[:student][:id] }).to eq [maya.id.to_s]
  end

  it "pages and reports truncation at the scan cap" do
    stub_const("#{described_class}::PER_PAGE", 1)
    stub_const("#{described_class}::SCAN_CAP", 1)
    submit(check, maya, at: now - 2.days)
    submit(check, ryan, at: now - 1.day)
    result = queue
    expect(result[:rows].size).to eq 1
    expect(result[:truncated]).to be true
  end
end
```

- [ ] **Step 2: Run to see it fail.** Run: `bin/rspec spec/services/teacher_workflow/grading_queue_spec.rb`. Expected: FAIL, `wrong number of arguments` or missing methods on `GradingQueue`.

- [ ] **Step 3: Implement**

```ruby
# frozen_string_literal: true

# (AGPL header)

module TeacherWorkflow
  # The grading queue (docs/superpowers/specs/2026-10-01-grading-queue-design.md):
  # the ungraded work in every course a viewer grades, ranked by how much it
  # holds a student up, then oldest first. Computed on read; nothing is stored.
  class GradingQueue
    SCAN_CAP = 500
    PER_PAGE = 25
    CACHE_FOR = 60.seconds
    ANONYMOUS = "Anonymous student"

    def initialize(viewer, course_id: nil, unit_id: nil, student_id: nil, held_up: false, page: 1, now: Time.zone.now)
      @viewer = viewer
      @course_id = course_id
      @unit_id = unit_id
      @student_id = student_id
      @held_up = ActiveModel::Type::Boolean.new.cast(held_up)
      @page = [page.to_i, 1].max
      @now = now
    end

    def result
      return build_result if Rails.env.test?

      Rails.cache.fetch(cache_key, expires_in: CACHE_FOR) { build_result }
    end

    private

    def cache_key
      ["teacher_workflow_grading_queue", @viewer&.global_id, @course_id, @unit_id, @student_id, @held_up, @page].cache_key
    end

    def build_result
      entries = Courses.for(@viewer, course_id: @course_id)
      rows = entries.flat_map { |entry| rows_for(entry) }
      rows.sort_by! { |row| [row[:tier], row[:submitted_at] || "9999", row[:id].to_i] }
      truncated = rows.size > SCAN_CAP || @scan_truncated
      rows = rows.first(SCAN_CAP)
      rows = rows.select { |row| row[:tier] <= Tiering::COULD_RELOCK } if @held_up
      {
        rows: rows.slice((@page - 1) * PER_PAGE, PER_PAGE) || [],
        page: @page,
        per_page: PER_PAGE,
        total: rows.size,
        truncated:,
        tier_counts: (1..4).index_with { |tier| rows.count { |row| row[:tier] == tier } }
      }
    end

    def rows_for(entry)
      course = entry.course
      index = ItemIndex.new(course)
      player = SelfPaced::Gating.player_course?(course)
      provisional = SelfPaced::Gating.provisional?(course)
      submissions = waiting(entry)
      @scan_truncated ||= submissions.size > SCAN_CAP
      states = SelfPaced::StudentCourseState.where(course:, user_id: submissions.map(&:user_id)).index_by(&:user_id)

      submissions.first(SCAN_CAP).filter_map do |submission|
        assignment = submission.assignment
        item = index.for_assignment(assignment)
        next if @unit_id.present? && item&.unit_id != @unit_id.to_i

        anonymous = assignment.anonymize_students?
        next if anonymous && @student_id.present?

        current = states[submission.user_id]&.current_content_tag_id&.then { |id| index.for_tag_id(id) }
        tier = Tiering.call(due_at: submission.cached_due_date, item:, current_item: current,
                            player:, provisional:, now: @now)
        build_row(submission, course, item, tier, anonymous)
      end
    end

    def waiting(entry)
      scope = Submission.needs_grading
                        .where(assignments: { context_type: "Course", context_id: entry.course.id, workflow_state: "published" })
                        .where(user_id: entry.student_ids)
                        .preload(:assignment, :user)
                        .reorder("submissions.submitted_at ASC NULLS LAST, submissions.id ASC")
                        .limit(SCAN_CAP + 1)
      scope = scope.where(user_id: @student_id) if @student_id.present?
      scope.to_a
    end

    def build_row(submission, course, item, tier, anonymous)
      assignment = submission.assignment
      name = anonymous ? ANONYMOUS : submission.user.name
      {
        id: submission.id.to_s,
        tier:,
        reason: reason(tier, name, submission),
        student: anonymous ? { id: nil, name: ANONYMOUS } : { id: submission.user_id.to_s, name: },
        course: { id: course.id.to_s, name: course.name },
        unit: item && { id: item.unit_id.to_s, name: item.unit_name },
        item: { id: assignment.id.to_s, title: assignment.title },
        submitted_at: submission.submitted_at&.iso8601,
        due_at: submission.cached_due_date&.iso8601,
        speed_grader_url: speed_grader_url(course, assignment, submission, anonymous)
      }
    end

    def speed_grader_url(course, assignment, submission, anonymous)
      who = anonymous ? "anonymous_id=#{submission.anonymous_id}" : "student_id=#{submission.user_id}"
      "/courses/#{course.id}/gradebook/speed_grader?assignment_id=#{assignment.id}&#{who}"
    end

    def reason(tier, name, submission)
      case tier
      when Tiering::BLOCKED
        I18n.t("%{student} is waiting on this to move on", student: name)
      when Tiering::COULD_RELOCK
        I18n.t("%{student} moved on with a provisional pass; a failing grade would lock them again", student: name)
      when Tiering::DUE_SOON
        I18n.t("Due %{when}", when: I18n.l(submission.cached_due_date, format: :short))
      else
        days = submission.submitted_at ? ((@now - submission.submitted_at) / 1.day).floor : 0
        I18n.t({ one: "Waiting 1 day", other: "Waiting %{count} days" }, count: days)
      end
    end
  end
end
```

Notes for the implementer: `Submission#cached_due_date` is the due date Canvas resolves per student (includes overrides). `Assignment#anonymize_students?` is true only for anonymous grading with grades not yet posted. Both exist in this tree (`app/models/abstract_assignment.rb:4159` for the latter). `I18n.t` with a hash of plural forms matches how neighbouring services build strings; if the project's lint wants `t()` in services, follow `SelfPaced::Alert#description`, which uses `I18n.t("...")` the same way.

- [ ] **Step 4: Run to see it pass.** Run: `bin/rspec spec/services/teacher_workflow/grading_queue_spec.rb`. Expected: PASS (10 examples). The quiz example is the most likely to need adjusting (setting up an essay attempt); keep the assertion that it is one row and disappears when graded.

- [ ] **Step 5: Query-count guard.** Add one example and keep it:

```ruby
it "does not run a query per submission" do
  4.times { |i| submit(check, student_in_course(course:, active_all: true, name: "S#{i}").user, at: now - i.days) }
  queue # warm
  count = 0
  counter = ->(*, payload) { count += 1 unless payload[:name] == "SCHEMA" }
  ActiveSupport::Notifications.subscribed(counter, "sql.active_record") { queue }
  expect(count).to be < 40
end
```

Run it. If the count is over the guard, find the N+1 (usually `submission.assignment` or `user` not preloaded, or `cached_due_date` loading overrides) and fix it in `waiting`, then re-run. Adjust the bound only to the measured count plus a small margin, and say why in a comment.

- [ ] **Step 6: Commit.** Message: `list ungraded work across a teacher's courses, ranked`.

---

### Task 5: Grading turnaround

**Files:**
- Create: `app/services/teacher_workflow/grading_turnaround.rb`
- Modify: `app/services/teacher_workflow/grading_queue.rb` (add `turnaround:` to the result)
- Test: `spec/services/teacher_workflow/grading_turnaround_spec.rb`

**Interfaces:**
- Produces: `GradingTurnaround.for(viewer, course_ids, now:)` returning `{ course_id => { median_hours: Float, graded_count: Integer } }`, counting submissions this viewer graded in the last 30 days that have a `submitted_at`. Courses with none are absent. `GradingQueue#result` gains `turnaround: { "<course_id>" => {median_hours:, graded_count:} }`.

- [ ] **Step 1: Write the failing test**

```ruby
describe TeacherWorkflow::GradingTurnaround do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:other_teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:assignment) { course.assignments.create!(title: "A", points_possible: 10, submission_types: "online_text_entry") }
  let(:now) { Time.zone.parse("2026-10-01 12:00:00 UTC") }

  def graded(student, submitted:, graded_at:, grader:)
    assignment.submit_homework(student, submission_type: "online_text_entry", body: "x", submitted_at: submitted)
    Submission.where(assignment:, user: student).update_all(graded_at:, grader_id: grader.id, score: 5, workflow_state: "graded")
  end

  it "is the viewer's median hours from submitted to graded" do
    graded(student_in_course(course:, active_all: true).user, submitted: now - 30.hours, graded_at: now - 24.hours, grader: teacher)
    graded(student_in_course(course:, active_all: true).user, submitted: now - 30.hours, graded_at: now - 6.hours, grader: teacher)
    graded(student_in_course(course:, active_all: true).user, submitted: now - 30.hours, graded_at: now - 1.hour, grader: other_teacher)

    result = described_class.for(teacher, [course.id], now:)
    expect(result[course.id][:graded_count]).to eq 2
    expect(result[course.id][:median_hours]).to be_within(0.01).of(15.0)
  end

  it "ignores grading older than 30 days and has no entry when there is none" do
    graded(student_in_course(course:, active_all: true).user, submitted: now - 60.days, graded_at: now - 59.days, grader: teacher)
    expect(described_class.for(teacher, [course.id], now:)).to eq({})
  end
end
```

- [ ] **Step 2: Run to see it fail.** Expected: `uninitialized constant TeacherWorkflow::GradingTurnaround`.

- [ ] **Step 3: Implement**

```ruby
# frozen_string_literal: true

# (AGPL header)

module TeacherWorkflow
  # How long this teacher takes to grade, per course: the median hours from a
  # student's submission to the grade, over the last 30 days. Computed from
  # submissions, with no history table.
  module GradingTurnaround
    WINDOW = 30.days

    def self.for(viewer, course_ids, now: Time.zone.now)
      return {} if viewer.nil? || course_ids.empty?

      rows = Submission.joins(:assignment)
                       .where(assignments: { context_type: "Course", context_id: course_ids })
                       .where(grader_id: viewer.id, graded_at: (now - WINDOW)..now)
                       .where.not(submitted_at: nil)
                       .group("assignments.context_id")
                       .pluck(
                         Arel.sql("assignments.context_id"),
                         Arel.sql("COUNT(*)"),
                         Arel.sql("percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (submissions.graded_at - submissions.submitted_at)))")
                       )
      rows.to_h { |course_id, count, seconds| [course_id, { median_hours: (seconds / 3600.0).round(1), graded_count: count }] }
    end
  end
end
```

- [ ] **Step 4: Wire it into the queue.** In `GradingQueue#build_result`, add after `rows` is computed:

```ruby
turnaround = GradingTurnaround.for(@viewer, entries.map { |e| e.course.id }, now: @now)
        .transform_keys(&:to_s)
```

and add `turnaround:` to the returned hash. Add to `grading_queue_spec.rb`:

```ruby
it "reports the viewer's turnaround" do
  submit(check, maya, at: now - 30.hours)
  Submission.where(user: maya).update_all(graded_at: now - 6.hours, grader_id: teacher.id, score: 5, workflow_state: "graded")
  expect(queue[:turnaround][course.id.to_s][:graded_count]).to eq 1
end
```

- [ ] **Step 5: Run both spec files.** Run: `bin/rspec spec/services/teacher_workflow/`. Expected: PASS.

- [ ] **Step 6: Commit.** Message: `show how fast a teacher turns grading around`.

---

### Task 6: API

**Files:**
- Create: `app/controllers/teacher_workflow/grading_queue_controller.rb`
- Modify: `config/routes.rb`
- Test: `spec/requests/teacher_workflow/grading_queue_spec.rb`

**Interfaces:**
- Consumes: `GradingQueue#result` (Task 4/5).
- Produces: `GET /api/v1/workflow/grading_queue` (route name `api_v1_workflow_grading_queue`) with `course_id`, `unit_id`, `student_id`, `held_up`, `page`; returns the result hash as JSON. 401 when signed out, 404 when the viewer's root account has the flag off.

- [ ] **Step 1: Write the failing test**

```ruby
describe "TeacherWorkflow::GradingQueueController", type: :request do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:assignment) { course.assignments.create!(title: "A", points_possible: 10, submission_types: "online_text_entry") }

  before do
    assignment.submit_homework(student, submission_type: "online_text_entry", body: "x", submitted_at: 1.day.ago)
    course.root_account.enable_feature!(:teacher_workflow)
    course.account.enable_feature!(:workflow_grading_queue)
  end

  it "returns the queue for a teacher" do
    user_session(teacher)
    get "/api/v1/workflow/grading_queue"
    expect(response).to be_successful
    body = response.parsed_body
    expect(body["rows"].size).to eq 1
    expect(body["tier_counts"]).to eq({ "1" => 0, "2" => 0, "3" => 0, "4" => 1 })
  end

  it "is empty for a student" do
    user_session(student)
    get "/api/v1/workflow/grading_queue"
    expect(response.parsed_body["rows"]).to eq []
  end

  it "needs a signed-in user" do
    get "/api/v1/workflow/grading_queue"
    expect(response).to have_http_status(:unauthorized)
  end

  it "is a 404 while the flag is off" do
    course.root_account.disable_feature!(:teacher_workflow)
    user_session(teacher)
    get "/api/v1/workflow/grading_queue"
    expect(response).to have_http_status(:not_found)
  end
end
```

- [ ] **Step 2: Run to see it fail.** Expected: routing error (404 for all).

- [ ] **Step 3: Add the routes.** In `config/routes.rb`, next to the other `scope(controller: "self_paced/...")` API blocks (around line 2857, inside the `api_v1` scope):

```ruby
    scope(controller: "teacher_workflow/grading_queue") do
      get "workflow/grading_queue", action: :index, as: "workflow_grading_queue"
    end
```

and next to `get "self_paced/dashboard"` (around line 1065):

```ruby
  get "workflow/grading" => "teacher_workflow/grading_queue#show", :as => :workflow_grading
```

- [ ] **Step 4: Implement the controller**

```ruby
# frozen_string_literal: true

# (AGPL header)

# The grading queue page and its API (docs/superpowers/specs/2026-10-01-grading-queue-design.md).
# All the rules about who sees what live in TeacherWorkflow::GradingQueue.
module TeacherWorkflow
  class GradingQueueController < ApplicationController
    before_action :require_user
    before_action :require_flag

    # GET /workflow/grading
    def show
      @page_title = t("Grading")
      add_body_class("full-width")
      js_env(WORKFLOW_GRADING_QUEUE: { queue_url: api_v1_workflow_grading_queue_path })
      js_bundle :workflow_grading_queue
      render html: '<div id="workflow_grading_queue"></div>'.html_safe, layout: true
    end

    # GET /api/v1/workflow/grading_queue
    def index
      render json: GradingQueue.new(@current_user,
                                    course_id: params[:course_id],
                                    unit_id: params[:unit_id],
                                    student_id: params[:student_id],
                                    held_up: params[:held_up],
                                    page: params[:page]).result
    end

    private

    # With the umbrella flag off the page and API don't exist. A signed-in
    # student still gets an empty queue from #index, not an error: who sees
    # what is GradingQueue's job.
    def require_flag
      head :not_found unless TeacherWorkflow.enabled?(@domain_root_account)
    end
  end
end
```

- [ ] **Step 5: Run to see it pass.** Run: `bin/rspec spec/requests/teacher_workflow/grading_queue_spec.rb`. Expected: PASS.

- [ ] **Step 6: Commit.** Message: `add the grading queue API and page route`.

---

### Task 7: The page, bundle and nav link

**Files:**
- Create: `ui/features/workflow_grading_queue/index.tsx`, `package.json`, `react/GradingQueueApp.tsx`, `react/types.ts`, `react/__tests__/GradingQueueApp.test.tsx`
- Modify: `ui/featureBundles.ts`, `app/models/teacher_workflow.rb` (add `queue_available?`), `app/controllers/application_controller.rb` (one line), `app/views/shared/_new_nav_header.html.erb` (two blocks), `ui/features/navigation_header/react/SideNav.tsx` (one block + one const)
- Test: the Vitest file above, `spec/models/teacher_workflow_spec.rb` (extend), `ui/features/navigation_header/react/__tests__/SideNav.test.tsx` (one example)

**Interfaces:**
- Consumes: API from Task 6; `ENV.WORKFLOW_GRADING_QUEUE = { queue_url }`.
- Produces: `TeacherWorkflow.queue_available?(user, root_account)` (cached 5 minutes, true when the umbrella is on and the user has an active teacher/TA enrollment); `ENV.WORKFLOW_GRADING_NAV_URL`.

- [ ] **Step 1: Write the failing Vitest test**

```tsx
import React from 'react'
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import doFetchApi from '@canvas/do-fetch-api-effect'
import GradingQueueApp from '../GradingQueueApp'

vi.mock('@canvas/do-fetch-api-effect')

const row = (over = {}) => ({
  id: '1', tier: 1, reason: 'Maya Lopez is waiting on this to move on',
  student: {id: '5', name: 'Maya Lopez'}, course: {id: '2', name: 'Algebra 1'},
  unit: {id: '3', name: 'Unit 1'}, item: {id: '4', title: 'Check 1'},
  submitted_at: '2026-09-29T12:00:00Z', due_at: null,
  speed_grader_url: '/courses/2/gradebook/speed_grader?assignment_id=4&student_id=5', ...over,
})
const payload = (rows: unknown[]) => ({
  json: {rows, page: 1, per_page: 25, total: rows.length, truncated: false,
         tier_counts: {1: 1, 2: 0, 3: 0, 4: 0}, turnaround: {'2': {median_hours: 15, graded_count: 2}}},
})

describe('GradingQueueApp', () => {
  beforeEach(() => vi.mocked(doFetchApi).mockResolvedValue(payload([row()]) as never))

  it('shows each row with its reason and a SpeedGrader link', async () => {
    render(<GradingQueueApp queueUrl="/api/v1/workflow/grading_queue" />)
    expect(await screen.findByText('Maya Lopez is waiting on this to move on')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: /grade check 1/i})).toHaveAttribute(
      'href', '/courses/2/gradebook/speed_grader?assignment_id=4&student_id=5')
  })

  it('shows the turnaround for the viewer', async () => {
    render(<GradingQueueApp queueUrl="/api/v1/workflow/grading_queue" />)
    expect(await screen.findByText(/median 15 hours/i)).toBeInTheDocument()
  })

  it('asks for held-up work only when the toggle is on', async () => {
    render(<GradingQueueApp queueUrl="/api/v1/workflow/grading_queue" />)
    await screen.findByText(/waiting on this/)
    await userEvent.click(screen.getByLabelText(/held up only/i))
    await waitFor(() =>
      expect(vi.mocked(doFetchApi)).toHaveBeenLastCalledWith(
        expect.objectContaining({params: expect.objectContaining({held_up: true})})))
  })

  it('says so when nothing is waiting', async () => {
    vi.mocked(doFetchApi).mockResolvedValue(payload([]) as never)
    render(<GradingQueueApp queueUrl="/api/v1/workflow/grading_queue" />)
    expect(await screen.findByText(/nothing is waiting/i)).toBeInTheDocument()
  })

  it('warns when the list was cut off', async () => {
    vi.mocked(doFetchApi).mockResolvedValue(
      {json: {...payload([row()]).json, truncated: true}} as never)
    render(<GradingQueueApp queueUrl="/api/v1/workflow/grading_queue" />)
    expect(await screen.findByText(/showing the first 500/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to see it fail.** Run: `yarn test:vitest ui/features/workflow_grading_queue`. Expected: cannot resolve `../GradingQueueApp`.

- [ ] **Step 3: Write `types.ts`, `GradingQueueApp.tsx`, `index.tsx`, `package.json`.**

`types.ts`:

```ts
export type QueueRow = {
  id: string
  tier: 1 | 2 | 3 | 4
  reason: string
  student: {id: string | null; name: string}
  course: {id: string; name: string}
  unit: {id: string; name: string} | null
  item: {id: string; title: string}
  submitted_at: string | null
  due_at: string | null
  speed_grader_url: string
}

export type QueueResult = {
  rows: QueueRow[]
  page: number
  per_page: number
  total: number
  truncated: boolean
  tier_counts: Record<string, number>
  turnaround: Record<string, {median_hours: number; graded_count: number}>
}
```

`GradingQueueApp.tsx` (InstUI; follow the imports used in `ui/features/self_paced_home/react/HomeApp.tsx`):

```tsx
import React, {useEffect, useState} from 'react'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Heading} from '@instructure/ui-heading'
import {Text} from '@instructure/ui-text'
import {Link} from '@instructure/ui-link'
import {Pill} from '@instructure/ui-pill'
import {Checkbox} from '@instructure/ui-checkbox'
import {Spinner} from '@instructure/ui-spinner'
import {Alert} from '@instructure/ui-alerts'
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import {Button} from '@instructure/ui-buttons'
import type {QueueResult} from './types'

const I18n = createI18nScope('workflow_grading_queue')

const TIER_LABEL: Record<number, string> = {
  1: I18n.t('Holding a student up'),
  2: I18n.t('Could lock a student again'),
  3: I18n.t('Due soon'),
  4: I18n.t('Waiting'),
}

export default function GradingQueueApp({queueUrl}: {queueUrl: string}) {
  const [heldUp, setHeldUp] = useState(false)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<QueueResult | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let current = true
    setError(false)
    doFetchApi({path: queueUrl, params: {held_up: heldUp, page}})
      .then(({json}) => current && setResult(json as QueueResult))
      .catch(() => current && setError(true))
    return () => {
      current = false
    }
  }, [queueUrl, heldUp, page])

  if (error) return <Alert variant="error">{I18n.t('The grading queue could not be loaded.')}</Alert>
  if (!result) return <Spinner renderTitle={I18n.t('Loading')} />

  const turnaround = Object.values(result.turnaround)
  const total = turnaround.reduce((n, t) => n + t.graded_count, 0)
  const median = total
    ? turnaround.reduce((sum, t) => sum + t.median_hours * t.graded_count, 0) / total
    : null

  return (
    <View as="div" padding="medium">
      <Heading level="h1">{I18n.t('Grading')}</Heading>
      {median !== null && (
        <Text as="p" size="small">
          {I18n.t('Your turnaround, last 30 days: median %{hours} hours', {hours: Math.round(median)})}
        </Text>
      )}
      <Checkbox
        label={I18n.t('Held up only')}
        checked={heldUp}
        onChange={() => {
          setPage(1)
          setHeldUp(v => !v)
        }}
      />
      {result.truncated && (
        <Alert variant="info" margin="small 0">
          {I18n.t('Showing the first 500 waiting items.')}
        </Alert>
      )}
      {result.rows.length === 0 ? (
        <Text as="p">{I18n.t('Nothing is waiting for you to grade.')}</Text>
      ) : (
        <ul style={{listStyle: 'none', padding: 0}}>
          {result.rows.map(row => (
            <li key={row.id} style={{borderBottom: '1px solid #ddd', padding: '0.75rem 0'}}>
              <Flex gap="small" wrap="wrap" alignItems="center">
                <Pill color={row.tier <= 2 ? 'danger' : 'primary'}>{TIER_LABEL[row.tier]}</Pill>
                <Text weight="bold">{row.reason}</Text>
              </Flex>
              <Text as="div" size="small">
                {[row.course.name, row.unit?.name, row.item.title].filter(Boolean).join(' · ')}
              </Text>
              <Link href={row.speed_grader_url}>
                {I18n.t('Grade %{item}', {item: row.item.title})}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Flex gap="small">
        <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{I18n.t('Previous')}</Button>
        <Button disabled={page * result.per_page >= result.total} onClick={() => setPage(p => p + 1)}>
          {I18n.t('Next')}
        </Button>
      </Flex>
    </View>
  )
}
```

`index.tsx`:

```tsx
import React from 'react'
import {render} from '@canvas/react'
import ready from '@instructure/ready'
import GradingQueueApp from './react/GradingQueueApp'

ready(() => {
  const container = document.getElementById('workflow_grading_queue')
  const config = (window.ENV as {WORKFLOW_GRADING_QUEUE?: {queue_url: string}}).WORKFLOW_GRADING_QUEUE
  if (!container || !config) return

  render(<GradingQueueApp queueUrl={config.queue_url} />, container)
})
```

`package.json`:

```json
{
  "name": "@canvas-features/workflow_grading_queue",
  "private": true,
  "version": "1.0.0",
  "owner": "teacher-workflow"
}
```

In `ui/featureBundles.ts`, after the `self_paced_setup` line, add:

```ts
  workflow_grading_queue: () => import('./features/workflow_grading_queue/index'),
```

If the package-import lint (`yarn check:ts`) rejects an unlisted `@instructure/ui-*` package, copy the exact import specifiers from `HomeApp.tsx`.

- [ ] **Step 4: Run to see it pass.** Run: `yarn test:vitest ui/features/workflow_grading_queue`. Expected: PASS (5 tests). The "median 15 hours" text must match the `I18n.t` output exactly: the component prints `median 15 hours`.

- [ ] **Step 5: Nav link, failing test first.** In `spec/models/teacher_workflow_spec.rb` add:

```ruby
describe ".queue_available?" do
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }

  it "is true for a grader when the umbrella is on, false for a student or with it off" do
    expect(described_class.queue_available?(teacher, course.root_account)).to be false
    course.root_account.enable_feature!(:teacher_workflow)
    expect(described_class.queue_available?(teacher, course.root_account)).to be true
    expect(described_class.queue_available?(student, course.root_account)).to be false
    expect(described_class.queue_available?(nil, course.root_account)).to be false
  end
end
```

Run it, see `NoMethodError`, then add to `teacher_workflow.rb`:

```ruby
  GRADER_TYPES = %w[TeacherEnrollment TaEnrollment].freeze

  # Whether to show the Grading link: the umbrella is on and the user teaches
  # or assists somewhere. Cached for five minutes, like the Students link.
  def self.queue_available?(user, root_account)
    return false unless user && root_account&.feature_enabled?(UMBRELLA_FLAG)

    Rails.cache.fetch(["teacher_workflow_queue_available", user.global_id, root_account.global_id].cache_key,
                      expires_in: 5.minutes) do
      user.enrollments.active_or_pending.where(type: GRADER_TYPES).exists?
    end
  end
```

(Then change `GradingQueue::Courses::GRADER_TYPES` to `TeacherWorkflow::GRADER_TYPES` so there is one list.) Run the spec, expect PASS.

- [ ] **Step 6: Wire the link.**

`app/controllers/application_controller.rb`, directly after the `SELF_PACED_DASHBOARD_NAV_URL` line (about 410):

```ruby
        @js_env[:WORKFLOW_GRADING_NAV_URL] = workflow_grading_path if TeacherWorkflow.queue_available?(@current_user, @domain_root_account)
```

`app/views/shared/_new_nav_header.html.erb`, after the `Students` link in the top bar (about line 121):

```erb
    <% if TeacherWorkflow.queue_available?(@current_user, @domain_root_account) %>
      <a href="<%= workflow_grading_path %>" class="<%= 'active' if active_path?('/workflow') %>"><%= t('Grading') %></a>
    <% end %>
```

and after the Students `<li>` in the global menu (about line 229) a matching `<li>` that reuses the `svg_icon_self_paced_students` partial and the id `global_nav_workflow_grading_link`.

`ui/features/navigation_header/react/SideNav.tsx`: next to `selfPacedDashboardUrl` (line 92) add

```tsx
  const workflowGradingUrl = (window.ENV as {WORKFLOW_GRADING_NAV_URL?: string} | undefined)
    ?.WORKFLOW_GRADING_NAV_URL
```

and after the Students `SideNavBar.Item` block:

```tsx
          {workflowGradingUrl && (
            <SideNavBar.Item
              id="workflow-grading-link"
              icon={<IconEditLine />}
              label={I18n.t('Grading')}
              href={workflowGradingUrl}
              selected={window.location.pathname.startsWith('/workflow')}
              themeOverride={{fontWeight: 400}}
              minimized={collapseSideNav}
            />
          )}
```

Import `IconEditLine` from `@instructure/ui-icons` beside the existing icon imports. Add one example to `SideNav.test.tsx` modelled on the one at line 407: with `WORKFLOW_GRADING_NAV_URL: '/workflow/grading'` set, a link named "Grading" with that href is shown.

- [ ] **Step 7: Run and commit.** Run `bin/rspec spec/models/teacher_workflow_spec.rb`, `yarn test:vitest ui/features/workflow_grading_queue ui/features/navigation_header`, and `yarn check:ts`. All must pass. Stage with `git add -p` for the three shared files; confirm with `git diff --cached` that only the lines above are staged. Message: `add the Grading page and link it from the nav`.

---

### Task 8: The `grading_backlog` alert

**Files:**
- Create: `db/migrate/20261001000000_create_workflow_backlog_alerts.rb`, `db/migrate/20261001000001_add_grading_backlog_notification.rb`, `app/models/teacher_workflow/backlog_alert.rb`, `app/services/teacher_workflow/backlog_evaluator.rb`, `app/messages/grading_backlog.email.erb`, `.email.html.erb`, `.sms.erb`, `.summary.erb`
- Modify: `app/models/account.rb` (one line), `config/initializers/periodic_jobs.rb` (one block), `app/models/teacher_workflow.rb` (nothing; flag already exists)
- Test: `spec/services/teacher_workflow/backlog_evaluator_spec.rb`

**Interfaces:**
- Consumes: `SchoolCalendar#count_between`, `Course#time_zone`, `Submission.needs_grading`, the `self_paced_manage_alert_rules` permission.
- Produces: `TeacherWorkflow::BacklogEvaluator.evaluate_all` (periodic entry point); `.evaluate_course(course, oldest_waiting_at, now:)`; table `workflow_backlog_alerts`; `Account#grading_backlog_days` (default 5); notification name `"Grading Backlog"`.

- [ ] **Step 1: Write the migrations.**

`20261001000000_create_workflow_backlog_alerts.rb`:

```ruby
# frozen_string_literal: true

# (AGPL header)

# Teacher workflow Phase 3 (docs/superpowers/specs/2026-10-01-grading-queue-design.md):
# one open row per course while its grading backlog is past the school's limit.
class CreateWorkflowBacklogAlerts < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :workflow_backlog_alerts do |t|
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :course, null: false, foreign_key: true, index: false
      t.string :workflow_state, null: false, default: "open", limit: 255
      t.datetime :oldest_waiting_at, null: false
      t.integer :school_days_waiting, null: false
      t.datetime :opened_at, null: false
      t.datetime :notified_at
      t.datetime :resolved_at
      t.timestamps

      t.check_constraint "workflow_state IN ('open', 'resolved')", name: "chk_workflow_backlog_alerts_state"
      t.index :course_id, unique: true, where: "workflow_state = 'open'", name: "index_workflow_backlog_alerts_open"
      t.index %i[course_id workflow_state]
      t.replica_identity_index
    end
  end
end
```

`20261001000001_add_grading_backlog_notification.rb` (copy `20260924150002_add_self_paced_alert_notification.rb` exactly, with name `"Grading Backlog"`, `delay_for: 0`, category `"Grading"`, and a comment saying it tells school admins when a course's grading backlog passes the limit).

- [ ] **Step 2: Account setting.** In `app/models/account.rb`, under `add_setting :supports_record_mode, inheritable: true`:

```ruby
  # teacher workflow (docs/superpowers/specs/2026-10-01-grading-queue-design.md): school days
  # of ungraded work before the grading_backlog alert opens
  add_setting :grading_backlog_days, inheritable: true
```

and read it through a small helper in `BacklogEvaluator` (`account.grading_backlog_days&.dig(:value).to_i`, falling back to 5 when blank or not positive).

- [ ] **Step 3: Model**

```ruby
# frozen_string_literal: true

# (AGPL header)

module TeacherWorkflow
  # A course whose grading backlog has passed the school's limit. One is open
  # at a time per course; the evaluator resolves it when the backlog clears.
  class BacklogAlert < ApplicationRecord
    self.table_name = "workflow_backlog_alerts"

    belongs_to :root_account, class_name: "Account"
    belongs_to :course

    scope :currently_open, -> { where(workflow_state: "open") }

    before_validation { self.root_account_id ||= course&.root_account_id }

    # Notification templates read the context.
    def context
      course
    end

    def resolve!(now = Time.zone.now)
      update!(workflow_state: "resolved", resolved_at: now)
    end
  end
end
```

- [ ] **Step 4: Write the failing evaluator test**

```ruby
describe TeacherWorkflow::BacklogEvaluator do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:admin) { account_admin_user(account: course.account) }
  let_once(:assignment) { course.assignments.create!(title: "A", points_possible: 10, submission_types: "online_text_entry") }
  let(:now) { Time.zone.parse("2026-10-14 15:00:00 UTC") } # a Wednesday

  before do
    course.root_account.enable_feature!(:teacher_workflow)
    course.account.enable_feature!(:workflow_grading_queue)
    Notification.find_or_create_by!(name: described_class::NOTIFICATION_NAME, category: "Grading")
  end

  def wait(since)
    assignment.submit_homework(student, submission_type: "online_text_entry", body: "x", submitted_at: since)
  end

  def run
    described_class.evaluate_all(now:)
  end

  it "opens nothing when nothing is waiting" do
    run
    expect(TeacherWorkflow::BacklogAlert.count).to eq 0
  end

  it "opens nothing while the oldest item is within the limit" do
    wait(Time.zone.parse("2026-10-12 10:00:00 UTC")) # Monday: 2 school days
    run
    expect(TeacherWorkflow::BacklogAlert.count).to eq 0
  end

  it "opens one alert and tells the admins, once, when the limit is passed" do
    wait(Time.zone.parse("2026-10-05 10:00:00 UTC")) # a week earlier
    expect { run }.to change { TeacherWorkflow::BacklogAlert.currently_open.count }.from(0).to(1)
    expect { run }.not_to change { TeacherWorkflow::BacklogAlert.count }

    alert = TeacherWorkflow::BacklogAlert.currently_open.sole
    expect(alert.school_days_waiting).to be >= 5
    expect(alert.notified_at).to be_present
    expect(Message.where(user: admin, notification_name: described_class::NOTIFICATION_NAME).count).to eq 1
    expect(Message.where(user: teacher, notification_name: described_class::NOTIFICATION_NAME)).to be_empty
  end

  it "resolves the alert, once, when the backlog clears" do
    wait(Time.zone.parse("2026-10-05 10:00:00 UTC"))
    run
    Submission.where(user: student).update_all(score: 5, workflow_state: "graded", grade_matches_current_submission: true)
    run
    expect(TeacherWorkflow::BacklogAlert.currently_open).to be_empty
    expect(TeacherWorkflow::BacklogAlert.where(workflow_state: "resolved").count).to eq 1
    run
    expect(TeacherWorkflow::BacklogAlert.where(workflow_state: "resolved").count).to eq 1
  end

  it "leaves courses without the flag alone" do
    course.account.disable_feature!(:workflow_grading_queue)
    wait(Time.zone.parse("2026-10-05 10:00:00 UTC"))
    run
    expect(TeacherWorkflow::BacklogAlert.count).to eq 0
  end

  it "uses the school's own limit" do
    course.account.settings = { grading_backlog_days: { value: 2 } }
    course.account.save!
    wait(Time.zone.parse("2026-10-12 10:00:00 UTC"))
    run
    expect(TeacherWorkflow::BacklogAlert.currently_open.count).to eq 1
  end
end
```

If `account.settings=` doesn't accept that shape for an `add_setting` without options in this tree, use `course.account.settings[:grading_backlog_days] = { value: 2 }` then `save!`, the way `spec` for `supports_record_mode` does (`grep -rn supports_record_mode spec`).

- [ ] **Step 5: Run to see it fail.** Expected: `uninitialized constant TeacherWorkflow::BacklogEvaluator`.

- [ ] **Step 6: Implement the evaluator**

```ruby
# frozen_string_literal: true

# (AGPL header)

module TeacherWorkflow
  # Opens a backlog alert for a course when its oldest ungraded item has waited
  # longer than the school's limit (in school days), tells the school's admins
  # once, and resolves the alert when the backlog clears.
  class BacklogEvaluator
    NOTIFICATION_NAME = "Grading Backlog"
    DEFAULT_DAYS = 5

    class << self
      # Periodic job. course_id => oldest waiting submission, for every course
      # that has any; open alerts for courses not in that list are resolved.
      def evaluate_all(now: Time.zone.now)
        oldest = Submission.needs_grading
                           .where(assignments: { context_type: "Course", workflow_state: "published" })
                           .group("assignments.context_id")
                           .minimum("submissions.submitted_at")
        Course.where(id: oldest.keys).preload(:root_account, :account).find_each do |course|
          next unless TeacherWorkflow.feature_enabled?(course, :workflow_grading_queue)

          evaluate_course(course, oldest.fetch(course.id), now:)
        end
        BacklogAlert.currently_open.where.not(course_id: oldest.keys).find_each { |alert| alert.resolve!(now) }
      end

      def evaluate_course(course, oldest_waiting_at, now: Time.zone.now)
        new(course, now:).evaluate(oldest_waiting_at)
      end
    end

    def initialize(course, now: Time.zone.now)
      @course = course
      @now = now
    end

    def evaluate(oldest_waiting_at)
      open_alert = BacklogAlert.currently_open.find_by(course_id: @course.id)
      days = school_days_waiting(oldest_waiting_at)

      if days >= limit
        open_alert ||= open_alert!(oldest_waiting_at, days)
        open_alert.update!(school_days_waiting: days, oldest_waiting_at:)
        notify(open_alert) if open_alert.notified_at.nil?
      elsif open_alert
        open_alert.resolve!(@now)
      end
    end

    private

    def limit
      value = @course.account.grading_backlog_days&.dig(:value).to_i
      value.positive? ? value : DEFAULT_DAYS
    end

    def school_days_waiting(oldest_waiting_at)
      zone = @course.time_zone
      SchoolCalendar.new(@course).count_between(oldest_waiting_at.in_time_zone(zone).to_date, @now.in_time_zone(zone).to_date)
    end

    def open_alert!(oldest_waiting_at, days)
      BacklogAlert.create!(course: @course, oldest_waiting_at:, school_days_waiting: days, opened_at: @now)
    end

    def notify(alert)
      notification = BroadcastPolicy.notification_finder.by_name(NOTIFICATION_NAME)
      return unless notification

      recipients = admins
      notification.create_message(alert, recipients) if recipients.any?
      alert.update_columns(notified_at: @now)
    end

    # School admins who can manage alert rules for the course's account.
    def admins
      account = @course.account
      AccountUser.active.where(account_id: account.account_chain_ids).preload(:user).filter_map(&:user).uniq
                 .select { |user| account.grants_right?(user, :self_paced_manage_alert_rules) }
    end
  end
end
```

- [ ] **Step 7: Templates.** Create the four `app/messages/grading_backlog.*` files, copying the structure of `self_paced_alert.*` (read those first). Subject: `t "Grading is backing up in %{course}", course: asset.course.name`. Body: `t "The oldest ungraded item in %{course} has waited %{days} school days.", course: asset.course.name, days: asset.school_days_waiting`. Link: `"#{HostUrl.protocol}://#{HostUrl.context_host(asset.course)}/courses/#{asset.course_id}/gradebook"`. No student names, no plan or accommodation data.

- [ ] **Step 8: Cron.** In `config/initializers/periodic_jobs.rb`, after the `AlertEvaluator` block:

```ruby
  Delayed::Periodic.cron "TeacherWorkflow::BacklogEvaluator.evaluate_all", "10 * * * *" do
    with_each_shard_by_database(TeacherWorkflow::BacklogEvaluator, :evaluate_all)
  end
```

- [ ] **Step 9: Run migrations and specs.** Run `bin/rake db:migrate` in the web container, then `bin/rspec spec/services/teacher_workflow/backlog_evaluator_spec.rb`. Expected: PASS (6 examples). Also run `bin/rubocop app/services/teacher_workflow app/models/teacher_workflow* db/migrate/20261001*`.

- [ ] **Step 10: Commit** the new files, plus `git add -p` on `account.rb` and `periodic_jobs.rb`. Message: `warn admins when grading backs up past the school limit`. If the repo tracks `db/structure.sql` or a schema dump, include its change.

---

### Task 9: Prove it at scale, check it in a browser, record it

**Files:**
- Modify: `docs/teacher-workflow-plan.md` (Phase 3 status block, header status line)
- Nothing else is committed: the 300-student course is built in a Rails console, and `lib/tasks/demo_data.rake` (untracked, other work's) is left alone.

- [ ] **Step 1: Build a 300-student course.** In a Rails console (`docker compose run --rm web rails c`), using the fictional-student rule from §4 of the plan:

```ruby
course = Course.create!(name: "Perf 300", account: Account.default); course.offer!
teacher = User.create!(name: "Perf Teacher"); course.enroll_teacher(teacher, enrollment_state: "active")
a = course.assignments.create!(title: "Perf check", points_possible: 10, submission_types: "online_text_entry")
300.times { |i| u = User.create!(name: "Perf Student #{i}"); course.enroll_student(u, enrollment_state: "active"); a.submit_homework(u, submission_type: "online_text_entry", body: "x", submitted_at: i.hours.ago) }
```

Enable `teacher_workflow` on the root account and `workflow_grading_queue` on the account.

- [ ] **Step 2: Measure.**

```ruby
require "benchmark"
t = Benchmark.realtime { TeacherWorkflow::GradingQueue.new(teacher).result }
puts t
```

Expected: well under 1 second warm, with 25 rows and `total` 300 (cache is bypassed outside production only by the `Rails.env.test?` check, so run it twice and note both timings). Record the query count with `ActiveSupport::Notifications` as in Task 4 step 5. If a page load is over 1 second or the query count grows with the number of rows, fix it before moving on (preloads in `waiting`, `Courses#entries`'s `pluck`) and re-measure. If it still can't be made fast, stop and report back: the spec says to move to a maintained table (approach B) at that point, which is a design change, not something to improvise.

- [ ] **Step 3: Check the ranking against the "done when".** In the same course, switch on the player and provisional mode (as `SelfPaced::CourseSetup` does; read it for the setting names), put one student's `current_content_tag` on the check, and confirm that student's row is first with tier 1 and the "waiting on this to move on" reason.

- [ ] **Step 4: Browser check.** Start the app (`docker compose up`, `yarn build:watch`), sign in as the Perf Teacher, open `/workflow/grading`. Confirm on desktop and phone width: rows show reason, course, unit, item; "Held up only" narrows the list; the Grade link opens SpeedGrader on the right student; Previous/Next page; the nav shows a Grading link. Count the clicks from landing to SpeedGrader open for the first row (target: one). Note anything that looks wrong and fix it before marking done.

- [ ] **Step 5: Run the whole set.** `bin/rspec spec/models/teacher_workflow_spec.rb spec/services/teacher_workflow spec/requests/teacher_workflow`, `yarn test:vitest ui/features/workflow_grading_queue ui/features/navigation_header`, `yarn check:ts`, `yarn check:biome`, `bin/rubocop` on the new Ruby files. All must pass. Say in the report if any could not be run.

- [ ] **Step 6: Record it.** In `docs/teacher-workflow-plan.md`, add after the Phase 3 bullet list a **Phase 3 status** block in the style of Phases 0 to 2: what was built (service, tiers, API, page, turnaround, `workflow_backlog_alerts` and `grading_backlog_days`), the measured timings and query count from Step 2, and these deliberate differences from the plan: namespace `TeacherWorkflow` (gem collision), the backlog alert uses its own table and an account setting instead of a new `AlertRule` kind, the per-teacher turnaround breakdown for admins is left for later, and admins see only a named course. Update the top-of-file status line to say Phase 3 is built. Commit with message `record the grading queue as built`.

---

## Self-Review

**Spec coverage.** Purpose and ranking: Tasks 3, 4. Row contents and anonymity: Task 4. Filters (course, unit, student, held-up): Tasks 2, 4, 7. Audience rule (graders only, section-limited TAs, admins by named course): Task 2. Data flow, 500 cap, 25 page, 60-second cache: Task 4. Turnaround: Task 5. API and page and flag-off behaviour: Task 6. Nav link: Task 7. `grading_backlog` alert, threshold, admin-only notification, once-only, resolve: Task 8. Testing list (tier specs, permission matrix, anonymous, request, Vitest, 300-student check, browser clicks-to-graded): Tasks 2 to 9. Gaps: none left open. Two spec items are narrowed on purpose and flagged in Task 9 step 6: the per-teacher admin turnaround, and admins needing to name a course.

**Placeholders.** None. Three spots depend on what the existing code does and say how to adapt: the section-limited TA setup in Task 2, the essay-quiz setup in Task 4, and the account-setting shape in Task 8 step 4.

**Type consistency.** `Courses::Entry(course, student_ids)`, `ItemIndex::Item(tag, unit_id, unit_name, order, grade_requirement)`, `Tiering.call(due_at:, item:, current_item:, player:, provisional:, now:)`, `GradingQueue#result` keys (`rows, page, per_page, total, truncated, tier_counts, turnaround`), row keys (`id, tier, reason, student, course, unit, item, submitted_at, due_at, speed_grader_url`) are the same in Tasks 3, 4, 5, 6 and 7. `GRADER_TYPES` moves to `TeacherWorkflow` in Task 7; Task 2 defines it on `Courses` first, and Task 7 step 5 collapses the two.
