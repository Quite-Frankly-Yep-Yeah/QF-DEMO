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

describe SelfPaced::ObserverView do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:jordan) { student_in_course(course:, active_all: true, name: "Jordan Kim").user }
  let_once(:parent) { observer_in_course(course:, associated_user_id: maya.id, active_all: true).user }
  let(:now) { Time.zone.parse("2026-09-25 15:00:00 UTC") }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.root_account.enable_feature!(:self_paced_observer_view)
    course.enable_feature!(:self_paced_course_player)
  end

  def view(observer = parent)
    described_class.new(observer, now:).as_json
  end

  def state(user = maya, **attrs)
    SelfPaced::StudentCourseState.create!({ course:, user:, root_account: course.root_account }.merge(attrs))
  end

  describe ".show_for?" do
    it "is for an observer with a linked student in a self-paced course" do
      expect(described_class.show_for?(User.find(parent.id), course.root_account)).to be true
    end

    it "isn't for people who are also students or staff, who keep their own home" do
      student_in_course(course:, user: parent, active_all: true)

      expect(described_class.show_for?(User.find(parent.id), course.root_account)).to be false
    end

    it "isn't shown while the observer view is off" do
      course.root_account.disable_feature!(:self_paced_observer_view)

      expect(described_class.show_for?(User.find(parent.id), course.root_account)).to be false
    end

    it "counts a parent the school linked to the student, even with no observer enrollment yet" do
      linked = user_factory(active_all: true)
      UserObservationLink.create_or_restore(student: maya, observer: linked, root_account: course.root_account)
      linked.observer_enrollments.delete_all

      expect(described_class.show_for?(User.find(linked.id), course.root_account)).to be true
      expect(view(linked)[:students].pluck(:name)).to eql(["Maya Lopez"])
    end

    it "isn't for an observer with nobody linked" do
      lonely = user_factory(active_all: true)

      expect(described_class.show_for?(lonely, course.root_account)).to be false
    end
  end

  describe "#as_json" do
    it "shows only the students the observer is linked to" do
      expect(view[:students].pluck(:name)).to eql(["Maya Lopez"])
    end

    it "shows progress and pace for each class" do
      state(percent_complete: 40,
            requirements_completed: 8,
            requirements_total: 20,
            days_behind: 2,
            expected_percent: 55,
            target_date: Date.new(2026, 11, 13),
            last_active_at: now - 2.days)

      expect(view[:students].first[:courses].first).to include(
        name: "Algebra 1",
        percent_complete: 40,
        requirements_completed: 8,
        requirements_total: 20,
        pace: { days_behind: 2, target_date: "2026-11-13", expected_percent: 55 }
      )
    end

    it "has no pace for a course that isn't paced" do
      state(days_behind: nil)

      expect(view[:students].first[:courses].first[:pace]).to be_nil
    end

    it "adds up time on task by day and against the week before" do
      today = now.to_date
      [[today, 1800], [today - 2, 600], [today - 9, 1200]].each do |day, seconds|
        SelfPaced::ActivityDay.create!(course:, user: maya, root_account: course.root_account, day:, active_seconds: seconds)
      end

      time = view[:students].first[:time]
      expect(time[:daily].length).to eq 7
      expect(time[:daily].last).to eql({ day: today.iso8601, minutes: 30 })
      expect(time).to include(week_minutes: 40, previous_week_minutes: 20)
    end

    it "shows posted grades only" do
      teacher = teacher_in_course(course:, active_all: true).user
      posted = assignment_model(course:, points_possible: 10, title: "Ratios check")
      hidden = assignment_model(course:, points_possible: 10, title: "Not posted yet")
      posted.grade_student(maya, grade: 8, grader: teacher)
      hidden.grade_student(maya, grade: 5, grader: teacher)
      Submission.where(assignment: posted, user: maya).update_all(graded_at: now - 1.day, posted_at: now - 1.day)
      Submission.where(assignment: hidden, user: maya).update_all(graded_at: now - 1.day, posted_at: nil)

      grades = view[:students].first[:grades]
      expect(grades.pluck(:title)).to eql(["Ratios check"])
      expect(grades.first).to include(score: 8.0, points_possible: 10.0, course: "Algebra 1")
    end

    it "lists open behind and inactive alerts, and no other kind or dismissed ones" do
      SelfPaced::Alert.create!(course:, student: maya, kind: "behind", detail: { "days_behind" => 4 }, opened_at: now)
      SelfPaced::Alert.create!(course:, student: maya, kind: "stuck", detail: { "attempts" => 4 }, opened_at: now)
      SelfPaced::Alert.create!(course:, student: maya, kind: "inactive", detail: { "days_inactive" => 5 }, opened_at: now, workflow_state: "dismissed")

      alerts = view[:students].first[:alerts]
      expect(alerts.pluck(:kind)).to eql(["behind"])
      expect(alerts.first[:description]).to eql("4 days behind their pace")
    end

    it "leaves out a course the student has left" do
      course.student_enrollments.find_by(user: maya).conclude

      expect(view[:students]).to be_empty
    end

    it "leaves out a course that isn't self-paced" do
      course.disable_feature!(:self_paced_course_player)

      expect(view[:students]).to be_empty
    end
  end
end
