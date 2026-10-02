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

  describe ".queue_available?" do
    let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
    let_once(:student) { student_in_course(course:, active_all: true).user }

    it "is true for a grader when both flags are on, false for a student or with either off" do
      expect(described_class.queue_available?(teacher, course.root_account)).to be false
      course.root_account.enable_feature!(:teacher_workflow)
      expect(described_class.queue_available?(teacher, course.root_account)).to be false
      course.account.enable_feature!(:workflow_grading_queue)
      expect(described_class.queue_available?(teacher, course.root_account)).to be true
      expect(described_class.queue_available?(student, course.root_account)).to be false
      expect(described_class.queue_available?(nil, course.root_account)).to be false
    end

    it "is true for an account admin when the queue is on, and false when it is off" do
      admin = account_admin_user(account: course.account)
      course.root_account.enable_feature!(:teacher_workflow)
      expect(described_class.queue_available?(admin, course.root_account)).to be false
      course.account.enable_feature!(:workflow_grading_queue)
      expect(described_class.queue_available?(admin, course.root_account)).to be true
    end
  end

  describe ".queue_enabled?" do
    let_once(:student) { student_in_course(course:, active_all: true).user }

    it "needs the umbrella and the phase flag" do
      expect(described_class.queue_enabled?(student, course.root_account)).to be false
      course.root_account.enable_feature!(:teacher_workflow)
      expect(described_class.queue_enabled?(student, course.root_account)).to be false
      course.account.enable_feature!(:workflow_grading_queue)
      expect(described_class.queue_enabled?(student, course.root_account)).to be true
    end

    it "also passes for a grader of a course whose own account has the flag" do
      root = course.root_account
      root.enable_feature!(:teacher_workflow)
      school = root.sub_accounts.create!(name: "School")
      school.enable_feature!(:workflow_grading_queue)
      school_course = course_factory(account: school, active_all: true)
      grader = teacher_in_course(course: school_course, active_all: true).user

      expect(described_class.queue_enabled?(grader, root)).to be true
      expect(described_class.queue_enabled?(student, root)).to be false
    end
  end
end
