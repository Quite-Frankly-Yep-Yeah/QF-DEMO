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

describe SelfPaced::StudentHome do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:other_course) { course_factory(active_all: true, course_name: "Art") }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:context_module) { course.context_modules.create!(name: "Unit 2") }
  let_once(:lesson_tag) { context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "2.3 Lesson").id) }

  before do
    student_in_course(course: other_course, user: student, active_all: true)
    course.root_account.enable_feature!(:self_paced)
    course.root_account.enable_feature!(:self_paced_student_home)
    course.enable_feature!(:self_paced_course_player)
  end

  def home
    described_class.new(User.find(student.id)).as_json
  end

  describe ".show_for?" do
    it "is for students once the home page is on" do
      expect(described_class.show_for?(User.find(student.id), course.root_account)).to be true
    end

    it "is for a student with no classes yet, like a freshly provisioned one" do
      newcomer = user_factory(active_all: true)

      expect(described_class.show_for?(User.find(newcomer.id), course.root_account)).to be true
      expect(described_class.new(User.find(newcomer.id)).as_json).to include(courses: [], other_courses: [], resume_course_id: nil)
    end

    it "isn't for staff, even if they also take a class" do
      student_in_course(course:, user: teacher, active_all: true)

      expect(described_class.show_for?(User.find(teacher.id), course.root_account)).to be false
    end

    it "isn't for a parent, who gets the observer view, unless they are a student too" do
      parent = observer_in_course(course:, associated_user_id: student.id, active_all: true).user

      expect(described_class.show_for?(User.find(parent.id), course.root_account)).to be false

      student_in_course(course: other_course, user: parent, active_all: true)
      expect(described_class.show_for?(User.find(parent.id), course.root_account)).to be true
    end

    it "isn't for a parent linked to a student without a class enrollment of their own" do
      parent = user_factory(active_all: true)
      UserObservationLink.create_or_restore(student:, observer: parent, root_account: course.root_account)

      expect(described_class.show_for?(User.find(parent.id), course.root_account)).to be false
    end

    it "isn't shown while the home page is off" do
      course.root_account.disable_feature!(:self_paced_student_home)

      expect(described_class.show_for?(User.find(student.id), course.root_account)).to be false
    end
  end

  describe "#as_json" do
    it "gives each self-paced class its progress and the item to continue with" do
      SelfPaced::StudentCourseState.create!(course:,
                                            user: student,
                                            root_account: course.root_account,
                                            percent_complete: 42.4,
                                            current_content_tag: lesson_tag,
                                            last_active_at: 1.hour.ago)
      card = home[:courses].first

      expect(card.slice(:name, :percent_complete, :url)).to eql(name: "Algebra 1", percent_complete: 42, url: "/courses/#{course.id}/player")
      expect(card[:continue]).to eql(title: "2.3 Lesson", module: "Unit 2", url: "/courses/#{course.id}/modules/items/#{lesson_tag.id}")
      expect(home[:resume_course_id]).to eql(course.id.to_s)
    end

    it "lists other classes separately" do
      expect(home[:other_courses].pluck(:name)).to eql(["Art"])
    end

    it "lists work due this week that isn't handed in, by the student's own due date" do
      due = course.assignments.create!(title: "2.3 Check", submission_types: "online_text_entry", due_at: 2.days.from_now)
      course.assignments.create!(title: "Next month", submission_types: "online_text_entry", due_at: 30.days.from_now)
      done = course.assignments.create!(title: "Handed in", submission_types: "online_text_entry", due_at: 1.day.from_now)
      done.submit_homework(student, body: "done")

      expect(home[:due_soon].map { |d| [d[:title], d[:url]] }).to eql([["2.3 Check", "/courses/#{course.id}/assignments/#{due.id}"]])
    end

    it "shows recent posted grades but never unposted ones" do
      posted = course.assignments.create!(title: "1.4 Check", points_possible: 10)
      posted.grade_student(student, score: 8, grader: teacher)
      hidden = course.assignments.create!(title: "1.5 Check", points_possible: 10)
      hidden.ensure_post_policy(post_manually: true)
      hidden.grade_student(student, score: 3, grader: teacher)

      expect(home[:feedback].map { |f| [f[:title], f[:score]] }).to eql([["1.4 Check", 8.0]])
    end
  end
end
