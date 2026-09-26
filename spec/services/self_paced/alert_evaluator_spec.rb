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
describe SelfPaced::AlertEvaluator do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let(:now) { Time.zone.parse("2026-09-22 15:00:00 UTC") }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.account.enable_feature!(:self_paced_activity_tracking)
    course.account.enable_feature!(:self_paced_alerts)
    Notification.find_or_create_by!(name: described_class::NOTIFICATION_NAME, category: "Grading")
  end

  def state(**attrs)
    SelfPaced::StudentCourseState.find_or_initialize_by(course:, user: student).tap do |s|
      s.assign_attributes({ root_account: course.root_account, last_active_at: now - 1.hour }.merge(attrs))
      s.save!
    end
  end

  def evaluate
    described_class.evaluate_course(course, now:)
  end

  def kinds
    SelfPaced::Alert.currently_open.where(student:).pluck(:kind)
  end

  describe ".evaluate_course" do
    it "opens nothing for a student who is on track" do
      state(days_behind: 0, attempts_on_current_item: 0)
      evaluate

      expect(SelfPaced::Alert.count).to eq 0
    end

    it "opens an alert for a student who is behind pace" do
      state(days_behind: 4)
      evaluate

      expect(kinds).to eql(["behind"])
      expect(SelfPaced::Alert.first.detail).to include("days_behind" => 4)
    end

    it "opens a stuck alert on the item they are stuck on" do
      tag = course.context_modules.create!(name: "Unit 1").add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson").id)
      state(current_content_tag: tag, attempts_on_current_item: 3)
      evaluate

      expect(kinds).to eql(["stuck"])
      expect(SelfPaced::Alert.first.content_tag).to eq tag
    end

    it "does not open a stuck alert when the student has no current item" do
      state(attempts_on_current_item: 5)
      evaluate

      expect(kinds).to be_empty
    end

    it "opens a max_attempts alert when the tries run out" do
      quiz = course.quizzes.create!(title: "Quiz", allowed_attempts: 2)
      quiz.publish!
      tag = course.context_modules.create!(name: "Unit 1").add_item(type: "quiz", id: quiz.id)
      state(current_content_tag: tag, attempts_on_current_item: 2)
      evaluate

      expect(kinds).to contain_exactly("max_attempts")
    end

    it "opens an inactive alert after the threshold of days" do
      state(last_active_at: now - 4.days)
      evaluate

      expect(kinds).to eql(["inactive"])
    end

    it "counts a student who was never active from when they were first tracked" do
      state(last_active_at: nil, created_at: now - 1.day)
      evaluate

      expect(kinds).to be_empty
    end

    it "leaves low_grade off until a rule turns it on" do
      state(current_score: 40.0)
      evaluate
      expect(kinds).to be_empty

      SelfPaced::AlertRule.create!(course:, kind: "low_grade", threshold: 60, enabled: true)
      evaluate
      expect(kinds).to eql(["low_grade"])
    end

    it "does not open the same alert twice" do
      state(days_behind: 4)
      evaluate
      evaluate

      expect(SelfPaced::Alert.count).to eq 1
    end

    it "resolves an alert when the trouble is over" do
      state(days_behind: 4)
      evaluate
      state(days_behind: 0)
      evaluate

      expect(kinds).to be_empty
      expect(SelfPaced::Alert.first).to have_attributes(workflow_state: "resolved", resolved_at: now)
    end

    it "does not reopen an alert staff dismissed while the trouble lasts, but does when it returns" do
      state(days_behind: 4)
      evaluate
      SelfPaced::Alert.first.dismiss!(teacher)
      evaluate
      expect(SelfPaced::Alert.currently_open).to be_empty

      state(days_behind: 0)
      evaluate
      state(days_behind: 5)
      evaluate
      expect(kinds).to eql(["behind"])
    end

    it "uses the course's own threshold" do
      SelfPaced::AlertRule.create!(course:, kind: "behind", threshold: 7)
      state(days_behind: 4)
      evaluate

      expect(kinds).to be_empty
    end

    it "honours a school-wide default that a course has not replaced" do
      SelfPaced::AlertRule.create!(root_account: course.root_account, kind: "behind", threshold: 2)
      state(days_behind: 2)
      evaluate

      expect(kinds).to eql(["behind"])
    end

    it "does nothing while the alerts flag is off" do
      course.account.disable_feature!(:self_paced_alerts)
      state(days_behind: 4)
      evaluate

      expect(SelfPaced::Alert.count).to eq 0
    end

    it "resolves alerts for students who left the course" do
      state(days_behind: 4)
      evaluate
      SelfPaced::StudentCourseState.where(course:).delete_all
      evaluate

      expect(kinds).to be_empty
    end

    context "notifications" do
      let(:notification) { Notification.find_by!(name: described_class::NOTIFICATION_NAME) }

      before do
        teacher.communication_channels.create!(path: "teacher@example.com").confirm!
        NotificationPolicy.find_or_create_by!(communication_channel: teacher.communication_channel, notification:, frequency: "immediately")
      end

      def messages
        Message.where(notification_name: described_class::NOTIFICATION_NAME)
      end

      it "tells the course's teachers when nobody has pinned the student" do
        state(days_behind: 4)
        evaluate

        expect(messages.pluck(:user_id)).to eql([teacher.id])
        expect(SelfPaced::Alert.first.notified_at).to eq now
      end

      it "tells the assigned mentor instead of the teachers" do
        mentor = user_factory(active_all: true)
        mentor.communication_channels.create!(path: "mentor@example.com").confirm!
        NotificationPolicy.find_or_create_by!(communication_channel: mentor.communication_channel, notification:, frequency: "immediately")
        SelfPaced::MentorCaseload.create!(mentor:, student:, root_account: course.root_account)
        state(days_behind: 4)
        evaluate

        expect(messages.pluck(:user_id)).to eql([mentor.id])
      end

      it "stays quiet when the rule says not to notify" do
        SelfPaced::AlertRule.create!(course:, kind: "behind", threshold: 3, notify: false)
        state(days_behind: 4)
        evaluate

        expect(SelfPaced::Alert.count).to eq 1
        expect(messages).to be_empty
      end

      context "for observers" do
        let(:observer_notification) { Notification.find_or_create_by!(name: described_class::OBSERVER_NOTIFICATION_NAME, category: "Grading") }

        let_once(:parent) { observer_in_course(course:, associated_user_id: student.id, active_all: true).user }

        before do
          course.root_account.enable_feature!(:self_paced_observer_view)
          parent.communication_channels.create!(path: "parent@example.com").confirm!
          NotificationPolicy.find_or_create_by!(communication_channel: parent.communication_channel, notification: observer_notification, frequency: "immediately")
        end

        def observer_messages
          Message.where(notification_name: described_class::OBSERVER_NOTIFICATION_NAME)
        end

        it "tells a parent when their student is behind" do
          state(days_behind: 4)
          evaluate

          expect(observer_messages.pluck(:user_id)).to eql([parent.id])
        end

        it "tells a parent when their student has gone quiet" do
          state(last_active_at: now - 4.days)
          evaluate

          expect(observer_messages.pluck(:user_id)).to eql([parent.id])
        end

        it "leaves stuck and grade alerts to staff" do
          SelfPaced::AlertRule.create!(course:, kind: "low_grade", threshold: 60, enabled: true)
          state(current_score: 40.0)
          evaluate

          expect(observer_messages).to be_empty
        end

        it "stays quiet while the observer view is off" do
          course.root_account.disable_feature!(:self_paced_observer_view)
          state(days_behind: 4)
          evaluate

          expect(observer_messages).to be_empty
        end
      end
    end
  end
end
