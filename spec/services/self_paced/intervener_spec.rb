# frozen_string_literal: true

#
# Copyright (C) 2026 - present quite frankly an example LMS contributors
#
# This file is part of quite frankly an example LMS, a modified version of Canvas.
#
# quite frankly an example LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# quite frankly an example LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

describe SelfPaced::Intervener do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:mentor) { user_factory(active_all: true) }
  let_once(:context_module) { course.context_modules.create!(name: "Unit 1") }
  let_once(:page_tag) { context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson 1.1").id) }
  let_once(:assignment) do
    course.assignments.create!(title: "Practice 1.1", submission_types: "online_text_entry", points_possible: 10, allowed_attempts: 2)
  end
  let_once(:assignment_tag) { context_module.add_item(type: "assignment", id: assignment.id) }
  let_once(:quiz) do
    course.quizzes.create!(title: "Check 1.1", quiz_type: "assignment", allowed_attempts: 2).tap(&:publish!)
  end
  let_once(:quiz_tag) { context_module.add_item(type: "quiz", id: quiz.id) }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.root_account.enable_feature!(:self_paced_interventions)
    course.enable_feature!(:self_paced_course_player)
  end

  # A course loaded after the flags and roles are in place, as in a request.
  def intervener(actor = teacher, **)
    described_class.new(Course.find(course.id), actor, **)
  end

  def make_mentor!
    course.account.account_users.create!(user: mentor, role: SelfPaced::MentorRole.ensure!(course.root_account))
  end

  describe "#perform" do
    it "logs who did what, for whom, on which item and why" do
      admin = account_admin_user(account: course.root_account)
      intervention = intervener(teacher, real_actor: admin).perform("unlock", student:, content_tag: page_tag, reason: "Absent Monday")

      expect(intervention.attributes.slice("kind", "student_id", "actor_id", "real_actor_id", "content_tag_id", "reason", "course_id"))
        .to eql("kind" => "unlock",
                "student_id" => student.id,
                "actor_id" => teacher.id,
                "real_actor_id" => admin.id,
                "content_tag_id" => page_tag.id,
                "reason" => "Absent Monday",
                "course_id" => course.id)
    end

    it "refuses everything but the finish date while interventions are off" do
      course.root_account.disable_feature!(:self_paced_interventions)

      expect { intervener.perform("unlock", student:, content_tag: page_tag) }.to raise_error(described_class::Denied)
    end

    it "refuses someone who isn't a student in the course" do
      expect { intervener.perform("unlock", student: teacher, content_tag: page_tag) }.to raise_error(described_class::Invalid)
    end

    it "refuses an item from another course" do
      other = course_factory(active_all: true)
      other_tag = other.context_modules.create!(name: "U").add_item(type: "wiki_page", id: other.wiki_pages.create!(title: "P").id)

      expect { intervener.perform("unlock", student:, content_tag: other_tag.id) }.to raise_error(described_class::Invalid)
    end

    it "keeps the log append-only" do
      intervention = intervener.perform("mark_complete", student:, content_tag: page_tag)

      expect { intervention.update!(reason: "changed") }.to raise_error(ActiveRecord::ReadOnlyRecord)
      expect { intervention.destroy }.to raise_error(ActiveRecord::ReadOnlyRecord)
    end
  end

  describe "unlock, mark complete and exempt" do
    it "unlocks an item for the student, and a quiz's own lock too" do
      intervener.perform("unlock", student:, content_tag: quiz_tag)

      expect(SelfPaced::ItemOverride.active.where(user: student, content_tag: quiz_tag).pluck(:kind)).to eql(["unlock"])
      expect(quiz.quiz_submissions.find_by(user: student).manually_unlocked).to be true
    end

    it "doesn't add a second override when the item is already unlocked" do
      2.times { intervener.perform("unlock", student:, content_tag: page_tag) }

      expect(SelfPaced::ItemOverride.active.where(user: student).count).to be 1
      expect(SelfPaced::Intervention.where(kind: "unlock").count).to be 2
    end

    it "exempts an ungraded item without touching grades" do
      intervention = intervener.perform("exempt", student:, content_tag: page_tag)

      expect(intervention.payload).to eql({})
      expect(SelfPaced::ItemOverride.active.where(user: student).pluck(:kind)).to eql(["exempt"])
    end

    it "excuses a graded item it exempts" do
      intervention = intervener.perform("exempt", student:, content_tag: assignment_tag)

      expect(assignment.reload.excused_for?(student)).to be true
      expect(intervention.payload).to include("excused" => true)
    end

    it "lets a mentor exempt a page but not a graded item" do
      make_mentor!

      expect { intervener(mentor).perform("exempt", student:, content_tag: page_tag) }.not_to raise_error
      expect { intervener(mentor).perform("exempt", student:, content_tag: assignment_tag) }.to raise_error(described_class::Denied)
    end

    it "undoes an exemption and un-excuses the grade" do
      intervener.perform("exempt", student:, content_tag: assignment_tag)
      intervention = intervener.perform("undo", student:, content_tag: assignment_tag, override_kind: "exempt")

      expect(SelfPaced::ItemOverride.active.where(user: student)).to be_empty
      expect(assignment.reload.excused_for?(student)).to be false
      expect(intervention.payload).to eql("override_kind" => "exempt", "unexcused" => true)
    end

    it "says so when there is nothing to undo" do
      expect { intervener.perform("undo", student:, content_tag: page_tag, override_kind: "unlock") }
        .to raise_error(described_class::Invalid, /no unlock to undo/)
    end
  end

  describe "attempts" do
    it "adds extra attempts to a quiz" do
      intervener.perform("extra_attempts", student:, content_tag: quiz_tag, attempts: 2)
      intervention = intervener.perform("extra_attempts", student:, content_tag: quiz_tag, attempts: "1")

      expect(quiz.quiz_submissions.find_by(user: student).extra_attempts).to be 3
      expect(intervention.payload).to eql("attempts" => 1, "extra_attempts_total" => 3, "allowed_attempts" => 2)
    end

    it "adds extra attempts to an assignment" do
      intervener.perform("extra_attempts", student:, content_tag: assignment_tag)

      expect(assignment.submissions.find_by(user: student).extra_attempts).to be 1
    end

    it "won't add attempts to a quiz that has no limit" do
      quiz.update!(allowed_attempts: -1)

      expect { intervener.perform("extra_attempts", student:, content_tag: quiz_tag.id) }.to raise_error(described_class::Invalid, /unlimited/)
    end

    it "keeps the reset attempt in the log and gives one more try" do
      submission = quiz.generate_submission(student)
      submission.update_columns(workflow_state: "complete", score: 4, kept_score: 4, finished_at: 1.hour.ago)
      intervention = intervener.perform("reset_attempt", student:, content_tag: quiz_tag, reason: "Fire drill")

      expect(intervention.payload["reset_attempt"]).to eql("attempt" => 1, "score" => 4.0, "workflow_state" => "complete")
      expect(submission.reload.extra_attempts).to be 1
    end

    it "has nothing to reset before the first attempt" do
      expect { intervener.perform("reset_attempt", student:, content_tag: quiz_tag) }.to raise_error(described_class::Invalid)
    end

    it "is for graders only" do
      make_mentor!

      expect { intervener(mentor).perform("extra_attempts", student:, content_tag: quiz_tag) }.to raise_error(described_class::Denied)
    end
  end

  describe "notes" do
    it "saves a note and logs it" do
      intervention = intervener.perform("note", student:, body: "  Parent called about absences  ")
      note = SelfPaced::StudentNote.last

      expect([note.body, note.author, note.course]).to eql(["Parent called about absences", teacher, course])
      expect(intervention.payload).to eql("note_id" => note.id.to_s)
    end

    it "refuses an empty note" do
      expect { intervener.perform("note", student:, body: " ") }.to raise_error(described_class::Invalid)
    end

    it "lets only the author delete a note" do
      intervener.perform("note", student:, body: "Doing well")
      note = SelfPaced::StudentNote.last
      other_teacher = teacher_in_course(course:, active_all: true).user

      expect { intervener(other_teacher).perform("delete_note", student:, note_id: note.id) }.to raise_error(described_class::Denied)
      intervener.perform("delete_note", student:, note_id: note.id)
      expect(note.reload.workflow_state).to eql("deleted")
    end
  end

  describe "messages" do
    it "sends the student a private message from the course" do
      intervention = intervener.perform("message", student:, body: "Come see me about 1.1", subject: "Check 1.1")
      conversation = Conversation.find(intervention.payload["conversation_id"])

      expect(conversation.participants.map(&:id)).to match_array([teacher.id, student.id])
      expect(conversation.conversation_messages.last.body).to eql("Come see me about 1.1")
      expect(conversation.subject).to eql("Check 1.1")
    end

    it "lets a mentor message a student" do
      make_mentor!

      expect { intervener(mentor).perform("message", student:, body: "How's it going?") }.not_to raise_error
    end
  end

  describe "#tools" do
    it "tells a mentor what they can use" do
      make_mentor!

      expect(intervener(mentor).tools).to include(unlock: true, exempt: true, exempt_graded: false, extra_attempts: false, note: true, message: true)
    end

    it "offers nothing but the finish date while interventions are off" do
      course.root_account.disable_feature!(:self_paced_interventions)

      expect(intervener.tools.except(:adjust_target).values.uniq).to eql([false])
    end
  end
end
