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

# A small sample school for trying the site after installing (rake
# qf:demo_data): one teacher, three students and a course with two modules.
# Safe to run again: anything already there is reused, nothing is duplicated.
module QfDemoData
  COURSE_SIS_ID = "qf-demo-course"
  EMAIL_DOMAIN = "demo.example.com"
  TEACHER = { login: "teacher@#{EMAIL_DOMAIN}", name: "Demo Teacher" }.freeze
  STUDENTS = [
    { login: "student1@#{EMAIL_DOMAIN}", name: "Ada Student" },
    { login: "student2@#{EMAIL_DOMAIN}", name: "Ben Student" },
    { login: "student3@#{EMAIL_DOMAIN}", name: "Cy Student" }
  ].freeze
  UNITS = [
    { name: "Unit 1: Expressions",
      page: { title: "Reading expressions", body: "<p>An expression combines numbers, variables and operations.</p>" },
      assignment: { title: "Practice: simplify expressions", points: 10 } },
    { name: "Unit 2: Linear equations",
      page: { title: "Solving one-step equations", body: "<p>Do the same thing to both sides to keep the balance.</p>" },
      assignment: { title: "Practice: solve for x", points: 10 } }
  ].freeze

  def self.loaded?(root_account)
    root_account.all_courses.active.where(sis_source_id: COURSE_SIS_ID).exists?
  end

  # Returns { course:, teacher:, students:, created: [logins made this run] }.
  # New logins get +password+; existing ones keep theirs.
  def self.load!(root_account, password:)
    created = []
    teacher = find_or_create_user(root_account, TEACHER, password, created)
    students = STUDENTS.map { |attrs| find_or_create_user(root_account, attrs, password, created) }
    course = find_or_create_course(root_account)

    enroll(course, teacher, "TeacherEnrollment")
    students.each { |student| enroll(course, student, "StudentEnrollment") }

    { course:, teacher:, students:, created: }
  end

  def self.find_or_create_user(root_account, attrs, password, created)
    pseudonym = root_account.pseudonyms.active.by_unique_id(attrs[:login]).first
    return pseudonym.user if pseudonym

    user = User.create!(name: attrs[:name])
    user.register!
    user.pseudonyms.create!(unique_id: attrs[:login],
                            password:,
                            password_confirmation: password,
                            account: root_account)
    user.communication_channels.create!(path: attrs[:login]) { |cc| cc.workflow_state = "active" }
    created << attrs[:login]
    user
  end

  def self.find_or_create_course(root_account)
    course = root_account.all_courses.active.find_by(sis_source_id: COURSE_SIS_ID)
    return course if course

    course = root_account.courses.create!(name: "Demo: Algebra I", course_code: "DEMO-ALG1", sis_source_id: COURSE_SIS_ID)
    UNITS.each_with_index do |unit, index|
      mod = course.context_modules.create!(name: unit[:name], position: index + 1)
      page = course.wiki_pages.create!(title: unit[:page][:title], body: unit[:page][:body])
      assignment = course.assignments.create!(title: unit[:assignment][:title],
                                              points_possible: unit[:assignment][:points],
                                              submission_types: "online_text_entry")
      assignment.publish! unless assignment.published?
      mod.add_item(type: "wiki_page", id: page.id)
      mod.add_item(type: "assignment", id: assignment.id)
    end
    course.offer!
    course
  end

  def self.enroll(course, user, type)
    return if course.enrollments.active.where(user:, type:).exists?

    course.enroll_user(user, type, enrollment_state: "active")
  end
end
